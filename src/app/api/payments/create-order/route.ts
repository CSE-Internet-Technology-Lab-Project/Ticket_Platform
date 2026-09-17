import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { razorpay } from "@/lib/razorpay";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to continue with payment." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);

  const reservationId =
    typeof body?.reservationId === "string" ? body.reservationId : "";

  if (!reservationId) {
    return NextResponse.json(
      { error: "reservationId is required." },
      { status: 400 },
    );
  }

  try {
    /*
     * Step 1:
     * Load the reservation and calculate the amount on the server.
     * We never trust the amount sent by the frontend.
     */
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        items: {
          include: {
            ticketInventory: true,
          },
        },
      },
    });

    if (!reservation || reservation.userId !== user.id) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      );
    }

    if (reservation.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This reservation is no longer active." },
        { status: 409 },
      );
    }

    if (reservation.expiresAt < new Date()) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "EXPIRED" },
        });

        await tx.ticketInventory.updateMany({
          where: {
            id: {
              in: reservation.items.map(
                (item) => item.ticketInventoryId,
              ),
            },
            status: "HELD",
          },
          data: {
            status: "AVAILABLE",
            version: {
              increment: 1,
            },
          },
        });
      });

      return NextResponse.json(
        { error: "Your seat hold has expired. Please choose seats again." },
        { status: 409 },
      );
    }

    const totalAmount = reservation.items.reduce(
      (total, item) =>
        total + item.ticketInventory.currentPrice.toNumber(),
      0,
    );

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 },
      );
    }

    /*
     * Step 2:
     * Check whether an internal order already exists for this reservation.
     *
     * reservationId is UNIQUE in the Order model, so we cannot create
     * multiple internal orders for the same reservation.
     */
    let order = await prisma.order.findUnique({
      where: {
        reservationId: reservation.id,
      },
      include: {
        payment: {
          include: {
            attempts: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        },
      },
    });

    /*
     * If an order already exists and is confirmed, payment is already complete.
     */
    if (order?.status === "CONFIRMED") {
      return NextResponse.json(
        {
          error: "This reservation has already been paid for.",
          orderId: order.id,
        },
        { status: 409 },
      );
    }

    /*
     * Step 3:
     * Create our internal PENDING Order, Payment and PaymentAttempt.
     */
    if (!order) {
      order = await prisma.order.create({
        data: {
          userId: user.id,
          eventId: reservation.eventId,
          reservationId: reservation.id,
          totalAmount,
          currency: "INR",
          status: "PENDING",

          items: {
            create: reservation.items.map((item) => ({
              ticketInventoryId: item.ticketInventoryId,
              unitPrice: item.ticketInventory.currentPrice,
            })),
          },

          payment: {
            create: {
              amount: totalAmount,
              currency: "INR",
              status: "PENDING",
              provider: "RAZORPAY",

              attempts: {
                create: {
                  idempotencyKey: crypto.randomUUID(),
                  amount: totalAmount,
                  currency: "INR",
                  status: "INITIATED",
                },
              },
            },
          },
        },

        include: {
          payment: {
            include: {
              attempts: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
              },
            },
          },
        },
      });
    }

    const payment = order.payment;

    if (!payment) {
      throw new Error("Payment record was not created.");
    }

    const attempt = payment.attempts[0];

    if (!attempt) {
      throw new Error("Payment attempt was not created.");
    }

    /*
     * Step 4:
     * Create an actual Razorpay Order.
     *
     * Razorpay expects the amount in paise:
     * ₹500 = 50000 paise
     */
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: order.id,
      notes: {
        orderId: order.id,
        reservationId: reservation.id,
        userId: user.id,
      },
    });

    /*
     * Step 5:
     * Save the Razorpay Order ID.
     *
     * providerOrderId = Razorpay Order ID
     * providerTransactionId will later contain Razorpay Payment ID.
     */
    await prisma.paymentAttempt.update({
      where: {
        id: attempt.id,
      },
      data: {
        providerOrderId: razorpayOrder.id,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);

    return NextResponse.json(
      {
        error: "Unable to create payment order.",
      },
      { status: 500 },
    );
  }
}
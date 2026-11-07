import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function verifyWebhookSignature(bodyText: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("Razorpay webhook secret is not configured.");
    return false;
  }
  const generatedSignature = createHmac("sha256", secret).update(bodyText).digest("hex");
  const genBuf = Buffer.from(generatedSignature, "utf8");
  const recBuf = Buffer.from(signature, "utf8");
  if (genBuf.length !== recBuf.length) return false;
  return timingSafeEqual(genBuf, recBuf);
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookEventId = (event.id as string) || `wh_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const eventType = event.event as string;

  // Process payment confirmation events
  if (eventType === "payment.captured" || eventType === "order.paid") {
    const paymentEntity = event.payload?.payment?.entity;
    const razorpayPaymentId = paymentEntity?.id as string | undefined;
    const razorpayOrderId = paymentEntity?.order_id as string | undefined;

    if (!razorpayOrderId) {
      return NextResponse.json({ received: true, note: "No razorpay order_id in payload" });
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          // Idempotency check on webhook event
          const existingWebhook = await tx.paymentWebhook.findUnique({
            where: { provider_eventId: { provider: "RAZORPAY", eventId: webhookEventId } },
          });
          if (existingWebhook?.processed) {
            return;
          }

          const attempt = await tx.paymentAttempt.findFirst({
            where: { providerOrderId: razorpayOrderId },
            include: {
              payment: {
                include: {
                  order: {
                    include: {
                      reservation: {
                        include: {
                          items: {
                            include: { ticketInventory: true },
                          },
                        },
                      },
                      items: true,
                    },
                  },
                },
              },
            },
          });

          if (!attempt || !attempt.payment?.order) {
            console.warn(`Webhook: No internal order found for razorpayOrderId ${razorpayOrderId}`);
            await tx.paymentWebhook.upsert({
              where: { provider_eventId: { provider: "RAZORPAY", eventId: webhookEventId } },
              create: { provider: "RAZORPAY", eventId: webhookEventId, payload: event, processed: false },
              update: {},
            });
            return;
          }

          const order = attempt.payment.order;
          if (order.status === "CONFIRMED") {
            // Already confirmed by client route, mark webhook processed
            await tx.paymentWebhook.upsert({
              where: { provider_eventId: { provider: "RAZORPAY", eventId: webhookEventId } },
              create: { provider: "RAZORPAY", eventId: webhookEventId, payload: event, processed: true, processedAt: new Date() },
              update: { processed: true, processedAt: new Date() },
            });
            return;
          }

          // Asynchronously reconcile and confirm order
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "SUCCESS",
              providerTransactionId: razorpayPaymentId ?? attempt.providerTransactionId,
              failureReason: null,
            },
          });

          await tx.payment.update({
            where: { id: attempt.payment.id },
            data: {
              status: "SUCCESS",
              provider: "RAZORPAY",
              transactionId: razorpayPaymentId ?? attempt.payment.transactionId,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { status: "CONFIRMED" },
          });

          if (order.reservation) {
            await tx.reservation.update({
              where: { id: order.reservation.id },
              data: { status: "COMPLETED" },
            });

            await tx.ticketInventory.updateMany({
              where: {
                id: { in: order.reservation.items.map((i) => i.ticketInventoryId) },
                status: "HELD",
              },
              data: { status: "SOLD", version: { increment: 1 } },
            });
          }

          for (const item of order.items) {
            const existingTicket = await tx.ticket.findUnique({
              where: { orderItemId: item.id },
            });
            if (!existingTicket) {
              await tx.ticket.create({
                data: {
                  orderItemId: item.id,
                  ticketInventoryId: item.ticketInventoryId,
                  ticketCode: `MOV-${randomBytes(6).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
                },
              });
            }
          }

          await tx.notification.create({
            data: {
              userId: order.userId,
              type: "BOOKING_CONFIRMED",
              title: "Movie tickets confirmed",
              message: `Your booking for order ${order.id.slice(0, 8)} is confirmed via payment reconciliation.`,
              status: "PENDING",
            },
          });

          await tx.outboxEvent.create({
            data: {
              eventType: "booking.confirmed",
              aggregateType: "Order",
              aggregateId: order.id,
              payload: { orderId: order.id, userId: order.userId, reconciledViaWebhook: true },
            },
          });

          await tx.paymentWebhook.upsert({
            where: { provider_eventId: { provider: "RAZORPAY", eventId: webhookEventId } },
            create: { provider: "RAZORPAY", eventId: webhookEventId, payload: event, processed: true, processedAt: new Date() },
            update: { processed: true, processedAt: new Date() },
          });
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 }
      );
    } catch (err) {
      console.error("Webhook processing error:", err);
      return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

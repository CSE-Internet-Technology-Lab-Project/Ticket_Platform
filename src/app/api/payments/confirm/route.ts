import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to complete payment." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const reservationId = typeof body?.reservationId === "string" ? body.reservationId : "";
  if (!reservationId) return NextResponse.json({ error: "reservationId is required." }, { status: 400 });
  try {
    const order = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { items: { include: { ticketInventory: true } } },
      });
      if (!reservation || reservation.userId !== user.id) throw new Error("RESERVATION_EXPIRED");
      if (reservation.status === "COMPLETED") {
        const existing = await tx.order.findUnique({ where: { reservationId: reservation.id }, include: { items: { include: { ticket: true } } } });
        if (existing) return existing;
      }
      if (reservation.status !== "ACTIVE" || reservation.expiresAt < new Date()) {
        if (reservation.status === "ACTIVE") {
          await tx.reservation.update({ where: { id: reservation.id }, data: { status: "EXPIRED" } });
          await tx.ticketInventory.updateMany({ where: { id: { in: reservation.items.map((item) => item.ticketInventoryId) }, status: "HELD" }, data: { status: "AVAILABLE", version: { increment: 1 } } });
        }
        throw new Error("RESERVATION_EXPIRED");
      }
      const totalAmount = reservation.items.reduce((total, item) => total + item.ticketInventory.currentPrice.toNumber(), 0);
      const order = await tx.order.create({
        data: {
          userId: user.id,
          eventId: reservation.eventId,
          reservationId: reservation.id,
          totalAmount,
          status: "CONFIRMED",
          items: { create: reservation.items.map((item) => ({ ticketInventoryId: item.ticketInventoryId, unitPrice: item.ticketInventory.currentPrice })) },
          payment: {
            create: {
              amount: totalAmount,
              status: "SUCCESS",
              provider: "DEMO_PAYMENT",
              transactionId: randomUUID(),
              attempts: { create: { idempotencyKey: randomUUID(), amount: totalAmount, status: "SUCCESS", providerTransactionId: randomUUID() } },
            },
          },
        },
        include: { items: true },
      });
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: "COMPLETED" } });
      await tx.ticketInventory.updateMany({ where: { id: { in: reservation.items.map((item) => item.ticketInventoryId) }, status: "HELD" }, data: { status: "SOLD", version: { increment: 1 } } });
      for (const item of order.items) {
        await tx.ticket.create({ data: { orderItemId: item.id, ticketInventoryId: item.ticketInventoryId, ticketCode: `MOV-${randomUUID().slice(0, 8).toUpperCase()}` } });
      }
      await tx.notification.create({ data: { userId: user.id, type: "BOOKING_CONFIRMED", title: "Movie tickets confirmed", message: `Your booking for ${reservation.items.length} seat(s) is confirmed.`, status: "PENDING" } });
      await tx.outboxEvent.create({ data: { eventType: "booking.confirmed", aggregateType: "Order", aggregateId: order.id, payload: { orderId: order.id, userId: user.id } } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { ticket: true } } } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    return NextResponse.json({ orderId: order.id, total: order.totalAmount.toNumber(), ticketCodes: order.items.map((item) => item.ticket?.ticketCode).filter((code): code is string => Boolean(code)) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "RESERVATION_EXPIRED") return NextResponse.json({ error: "Your seat hold has expired. Please choose seats again." }, { status: 409 });
    return NextResponse.json({ error: "Payment could not be completed. No charge was made." }, { status: 500 });
  }
}

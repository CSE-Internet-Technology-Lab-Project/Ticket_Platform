import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { calculateDynamicPrice } from "@/lib/pricing";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to reserve seats." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  const rawInventoryIds: unknown[] = Array.isArray(body?.inventoryIds) ? body.inventoryIds : [];
  const inventoryIds = rawInventoryIds.filter((id): id is string => typeof id === "string");
  if (!eventId || inventoryIds.length < 1 || inventoryIds.length > 6 || new Set(inventoryIds).size !== inventoryIds.length) {
    return NextResponse.json({ error: "Choose between one and six unique seats." }, { status: 400 });
  }
  try {
    const event = await prisma.event.findFirst({ where: { id: eventId, status: "PUBLISHED", startTime: { gte: new Date() } }, include: { pricingPolicy: { include: { rules: { where: { enabled: true } } } }, inventories: { include: { ticketType: true } } } });
    if (!event) return NextResponse.json({ error: "That showtime is no longer available." }, { status: 404 });
    const available = event.inventories.filter((item) => item.status === "AVAILABLE").length;
    const hoursUntilEvent = Math.max(0, (event.startTime.getTime() - Date.now()) / 3_600_000);
    const isWeekend = [0, 6].includes(event.startTime.getDay());
    if (event.pricingPolicy?.enabled && event.inventories.length > 0) {
      for (const inventory of event.inventories.filter((item) => item.status === "AVAILABLE")) {
        const result = calculateDynamicPrice(inventory.ticketType.basePrice.toNumber(), event.pricingPolicy.rules, { remainingPercentage: (available / event.inventories.length) * 100, hoursUntilEvent, isWeekend, ticketTypeId: inventory.ticketTypeId }, { minimum: event.pricingPolicy.minimumPrice?.toNumber(), maximum: event.pricingPolicy.maximumPrice?.toNumber() });
        if (inventory.currentPrice.toNumber() !== result.price) await prisma.ticketInventory.update({ where: { id: inventory.id }, data: { currentPrice: result.price, version: { increment: 1 }, priceHistory: { create: { price: result.price, reason: result.reasons.join(", ") || "Base price" } } } });
      }
    }
    const reservation = await prisma.$transaction(async (tx) => {
      const expired = await tx.reservation.findMany({
        where: { eventId, status: "ACTIVE", expiresAt: { lt: new Date() } },
        include: { items: { select: { ticketInventoryId: true } } },
      });
      if (expired.length) {
        await tx.reservation.updateMany({ where: { id: { in: expired.map((item) => item.id) } }, data: { status: "EXPIRED" } });
        await tx.ticketInventory.updateMany({
          where: { id: { in: expired.flatMap((item) => item.items.map((seat) => seat.ticketInventoryId)) }, status: "HELD" },
          data: { status: "AVAILABLE", version: { increment: 1 } },
        });
      }
      const updated = await tx.ticketInventory.updateMany({
        where: { id: { in: inventoryIds }, eventId, status: "AVAILABLE" },
        data: { status: "HELD", version: { increment: 1 } },
      });
      if (updated.count !== inventoryIds.length) throw new Error("SEAT_UNAVAILABLE");
      return tx.reservation.create({
        data: {
          userId: user.id, eventId, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          items: { create: inventoryIds.map((ticketInventoryId) => ({ ticketInventoryId })) },
        },
        select: { id: true, expiresAt: true },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SEAT_UNAVAILABLE") {
      return NextResponse.json({ error: "One or more seats were just booked. Please choose again." }, { status: 409 });
    }
    return NextResponse.json({ error: "We could not hold those seats. Please try again." }, { status: 500 });
  }
}

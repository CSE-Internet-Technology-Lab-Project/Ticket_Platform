import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDynamicPrice } from "@/lib/pricing";
import { getOrganizer } from "@/lib/current-user";

export async function POST(request: Request) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  const event = await prisma.event.findUnique({
    where: { id: eventId, organizerId: organizer.id },
    include: {
      pricingPolicy: { include: { rules: { where: { enabled: true } } } },
      inventories: { include: { ticketType: true } },
    },
  });
  if (!event || !event.pricingPolicy?.enabled) return NextResponse.json({ error: "No active pricing policy exists for this showtime." }, { status: 404 });
  const total = event.inventories.length;
  const available = event.inventories.filter((item) => item.status === "AVAILABLE").length;
  const hoursUntilEvent = Math.max(0, (event.startTime.getTime() - Date.now()) / 3_600_000);
  const isWeekend = [0, 6].includes(event.startTime.getDay());
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const inventory of event.inventories.filter((item) => item.status === "AVAILABLE")) {
      const result = calculateDynamicPrice(inventory.ticketType.basePrice.toNumber(), event.pricingPolicy!.rules, { remainingPercentage: (available / total) * 100, hoursUntilEvent, isWeekend, ticketTypeId: inventory.ticketTypeId }, { minimum: event.pricingPolicy!.minimumPrice?.toNumber(), maximum: event.pricingPolicy!.maximumPrice?.toNumber() });
      if (inventory.currentPrice.toNumber() !== result.price) {
        await tx.ticketInventory.update({ where: { id: inventory.id }, data: { currentPrice: result.price, version: { increment: 1 }, priceHistory: { create: { price: result.price, reason: result.reasons.join(", ") || "Base price" } } } });
        changed++;
      }
    }
  });
  return NextResponse.json({ changed, availability: { available, total }, pricingAppliedAt: new Date().toISOString() });
}

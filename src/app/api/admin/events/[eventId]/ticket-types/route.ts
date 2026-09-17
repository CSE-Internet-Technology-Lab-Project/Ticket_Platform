import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAllEvents, getOrganizer } from "@/lib/current-user";

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const ticketTypes: unknown[] = Array.isArray(body?.ticketTypes) ? body.ticketTypes : [];
  if (!ticketTypes.length) return NextResponse.json({ error: "Provide at least one ticket type." }, { status: 400 });
  const updates = ticketTypes.map((rawTicketType) => { const ticketType = rawTicketType as Record<string, unknown>; return { id: typeof ticketType.id === "string" ? ticketType.id : "", name: typeof ticketType.name === "string" ? ticketType.name.trim() : "", description: typeof ticketType.description === "string" ? ticketType.description.trim() || null : null, basePrice: Number(ticketType.basePrice) }; });
  if (updates.some((ticketType) => !ticketType.id || !ticketType.name || !Number.isFinite(ticketType.basePrice) || ticketType.basePrice < 0)) return NextResponse.json({ error: "Each ticket type needs a name and valid base price." }, { status: 400 });
  const event = await prisma.event.findFirst({ where: { id: eventId, ...(canManageAllEvents(organizer) ? {} : { organizerId: organizer.id }) }, select: { id: true, pricingPolicy: { select: { enabled: true } } } });
  if (!event) return NextResponse.json({ error: "Showtime not found." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    for (const ticketType of updates) {
      const updated = await tx.ticketType.updateMany({ where: { id: ticketType.id, eventId }, data: { name: ticketType.name, description: ticketType.description, basePrice: ticketType.basePrice } });
      if (!updated.count) throw new Error("TICKET_TYPE_NOT_FOUND");
      // When dynamic pricing is off, the visible price follows the operator's base price immediately.
      if (!event.pricingPolicy?.enabled) {
        const inventories = await tx.ticketInventory.findMany({ where: { eventId, ticketTypeId: ticketType.id, status: "AVAILABLE" }, select: { id: true } });
        for (const inventory of inventories) await tx.ticketInventory.update({ where: { id: inventory.id }, data: { currentPrice: ticketType.basePrice, version: { increment: 1 }, priceHistory: { create: { price: ticketType.basePrice, reason: "Base price updated by organizer" } } } });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

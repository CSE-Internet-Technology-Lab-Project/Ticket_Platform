import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrganizer } from "@/lib/current-user";

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const { eventId } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    include: {
      venue: { select: { name: true, city: true, address: true } },
      ticketTypes: { orderBy: { basePrice: "asc" }, select: { id: true, name: true, description: true, basePrice: true, quantity: true } },
      pricingPolicy: { include: { rules: { orderBy: { priority: "desc" }, select: { id: true, name: true, type: true, adjustmentType: true, adjustmentValue: true, conditions: true, priority: true, enabled: true, ticketTypeId: true } } } },
      inventories: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, currentPrice: true, ticketTypeId: true, seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } }, priceHistory: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, price: true, reason: true, createdAt: true } } } },
      orders: { orderBy: { createdAt: "desc" }, take: 40, select: { id: true, totalAmount: true, status: true, createdAt: true, user: { select: { name: true, email: true } }, items: { select: { unitPrice: true, ticket: { select: { ticketCode: true, status: true } } } } } },
    },
  });
  if (!event) return NextResponse.json({ error: "Showtime not found." }, { status: 404 });
  return NextResponse.json({ event });
}

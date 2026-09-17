import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAllEvents, getOrganizer } from "@/lib/current-user";

export async function GET() {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });

  const events = await prisma.event.findMany({
    where: canManageAllEvents(organizer) ? undefined : { organizerId: organizer.id },
    orderBy: { startTime: "asc" },
    include: {
      venue: { select: { name: true, city: true } },
      ticketTypes: { select: { id: true, name: true, basePrice: true, quantity: true } },
      inventories: { select: { status: true, currentPrice: true } },
      pricingPolicy: { select: { enabled: true, minimumPrice: true, maximumPrice: true, rules: { select: { id: true, name: true, type: true, adjustmentType: true, adjustmentValue: true, enabled: true } } } },
      _count: { select: { orders: true } },
    },
  });
  return NextResponse.json({ organizer: { name: organizer.name, email: organizer.email }, events });
}

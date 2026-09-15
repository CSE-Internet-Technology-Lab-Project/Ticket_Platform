import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrganizer } from "@/lib/current-user";

const seatPlan = [
  { name: "CLASSIC", rows: 2, seats: 10, seatType: "REGULAR" as const, price: 220 },
  { name: "PRIME", rows: 3, seats: 10, seatType: "PREMIUM" as const, price: 350 },
  { name: "RECLINER", rows: 1, seats: 8, seatType: "VIP" as const, price: 570 },
];

export async function POST(request: Request) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const city = typeof body?.city === "string" ? body.city.trim() : "Bengaluru";
  const venueName = typeof body?.venueName === "string" ? body.venueName.trim() : "";
  const startTime = typeof body?.startTime === "string" ? new Date(body.startTime) : new Date("");
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  if (!name || !venueName || Number.isNaN(startTime.getTime()) || startTime <= new Date()) {
    return NextResponse.json({ error: "Add a movie title, venue, city, and a future start time." }, { status: 400 });
  }

  const event = await prisma.$transaction(async (tx) => {
    const capacity = seatPlan.reduce((total, section) => total + section.rows * section.seats, 0);
    const venue = await tx.venue.create({ data: { name: venueName, city, address: `${city} cinema district`, capacity, createdById: organizer.id } });
    const sections = await Promise.all(seatPlan.map((section) => tx.venueSection.create({ data: { venueId: venue.id, name: section.name, capacity: section.rows * section.seats } })));
    const event = await tx.event.create({
      data: {
        organizerId: organizer.id, venueId: venue.id, name, description, type: "MOVIE", startTime,
        endTime: new Date(startTime.getTime() + 135 * 60 * 1000), status: "DRAFT",
      },
    });
    const ticketTypes = await Promise.all(seatPlan.map((section) => tx.ticketType.create({ data: { eventId: event.id, name: section.name, description: `${section.name} movie seating`, basePrice: section.price, quantity: section.rows * section.seats } })));
    const sectionSeats = await Promise.all(seatPlan.map(async (plan, index) => {
      const seats = Array.from({ length: plan.rows * plan.seats }, (_, position) => ({ sectionId: sections[index].id, rowNumber: Math.floor(position / plan.seats), seatNumber: (position % plan.seats) + 1, seatType: plan.seatType }));
      await tx.seat.createMany({ data: seats });
      return tx.seat.findMany({ where: { sectionId: sections[index].id }, select: { id: true } });
    }));
    await tx.ticketInventory.createMany({ data: sectionSeats.flatMap((seats, index) => seats.map((seat) => ({ eventId: event.id, seatId: seat.id, ticketTypeId: ticketTypes[index].id, currentPrice: seatPlan[index].price }))) });
    await tx.pricingPolicy.create({
      data: { eventId: event.id, enabled: true, minimumPrice: 180, maximumPrice: 800, rules: { create: [
        { name: "Early booking saving", type: "EARLY_BIRD", adjustmentType: "PERCENTAGE", adjustmentValue: -5, conditions: { minimumHoursBefore: 72 }, priority: 30 },
        { name: "Weekend premium", type: "WEEKEND", adjustmentType: "PERCENTAGE", adjustmentValue: 8, priority: 20 },
        { name: "High demand uplift", type: "INVENTORY", adjustmentType: "PERCENTAGE", adjustmentValue: 10, conditions: { remainingPercentage: 50 }, priority: 10 },
        { name: "Last seats uplift", type: "DEMAND", adjustmentType: "PERCENTAGE", adjustmentValue: 8, conditions: { remainingPercentage: 30 }, priority: 9 },
        { name: "Last-minute uplift", type: "LAST_MINUTE", adjustmentType: "PERCENTAGE", adjustmentValue: 7, conditions: { hoursBefore: 4 }, priority: 8 },
      ] } },
    });
    return event;
  });
  return NextResponse.json({ event }, { status: 201 });
}

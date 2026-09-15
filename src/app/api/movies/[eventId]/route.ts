import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDynamicPrice } from "@/lib/pricing";

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const movie = await prisma.event.findFirst({
    where: { id: eventId, type: "MOVIE", status: "PUBLISHED", startTime: { gte: new Date() } },
    include: {
      venue: { select: { name: true, address: true, city: true } },
      ticketTypes: { select: { id: true, name: true, description: true, basePrice: true } },
      pricingPolicy: { include: { rules: { where: { enabled: true } } } },
      inventories: { include: { ticketType: true, seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } } } },
    },
  });
  if (!movie) return NextResponse.json({ error: "That showtime is unavailable." }, { status: 404 });
  const available = movie.inventories.filter((item) => item.status === "AVAILABLE").length;
  const total = movie.inventories.length;
  const hoursUntilEvent = Math.max(0, (movie.startTime.getTime() - Date.now()) / 3_600_000);
  const isWeekend = [0, 6].includes(movie.startTime.getDay());
  if (movie.pricingPolicy?.enabled && total > 0) {
    await prisma.$transaction(async (tx) => {
      for (const inventory of movie.inventories.filter((item) => item.status === "AVAILABLE")) {
        const result = calculateDynamicPrice(inventory.ticketType.basePrice.toNumber(), movie.pricingPolicy!.rules, { remainingPercentage: (available / total) * 100, hoursUntilEvent, isWeekend, ticketTypeId: inventory.ticketTypeId }, { minimum: movie.pricingPolicy!.minimumPrice?.toNumber(), maximum: movie.pricingPolicy!.maximumPrice?.toNumber() });
        if (inventory.currentPrice.toNumber() !== result.price) {
          await tx.ticketInventory.update({ where: { id: inventory.id }, data: { currentPrice: result.price, version: { increment: 1 }, priceHistory: { create: { price: result.price, reason: result.reasons.join(", ") || "Base price" } } } });
        }
      }
    });
  }
  const refreshed = await prisma.event.findUnique({ where: { id: movie.id }, select: { id: true, name: true, description: true, startTime: true, venue: { select: { name: true, address: true, city: true } }, ticketTypes: { select: { id: true, name: true, description: true, basePrice: true } }, pricingPolicy: { select: { enabled: true, minimumPrice: true, maximumPrice: true, rules: { where: { enabled: true }, select: { name: true, type: true } } } }, inventories: { select: { id: true, currentPrice: true, status: true, seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } } } } } });
  return NextResponse.json({ movie: refreshed });
}

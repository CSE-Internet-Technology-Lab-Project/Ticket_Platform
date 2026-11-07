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
      inventories: {
        include: {
          ticketType: true,
          seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } },
        },
      },
    },
  });

  if (!movie) return NextResponse.json({ error: "That showtime is unavailable." }, { status: 404 });

  const available = movie.inventories.filter((item) => item.status === "AVAILABLE").length;
  const total = movie.inventories.length;
  const hoursUntilEvent = Math.max(0, (movie.startTime.getTime() - Date.now()) / 3_600_000);
  const isWeekend = [0, 6].includes(movie.startTime.getDay());

  // Compute display prices in memory for the response without mutating database on read requests
  const inventoriesWithDynamicPrice = movie.inventories.map((inventory) => {
    let displayPrice = inventory.currentPrice.toNumber();
    if (movie.pricingPolicy?.enabled && total > 0 && inventory.status === "AVAILABLE") {
      const result = calculateDynamicPrice(
        inventory.ticketType.basePrice.toNumber(),
        movie.pricingPolicy.rules,
        {
          remainingPercentage: (available / total) * 100,
          hoursUntilEvent,
          isWeekend,
          ticketTypeId: inventory.ticketTypeId,
        },
        {
          minimum: movie.pricingPolicy.minimumPrice?.toNumber(),
          maximum: movie.pricingPolicy.maximumPrice?.toNumber(),
        },
      );
      displayPrice = result.price;
    }

    return {
      id: inventory.id,
      currentPrice: displayPrice,
      status: inventory.status,
      seat: inventory.seat,
    };
  });

  return NextResponse.json({
    movie: {
      id: movie.id,
      name: movie.name,
      description: movie.description,
      imageUrl: movie.imageUrl,
      startTime: movie.startTime,
      venue: movie.venue,
      ticketTypes: movie.ticketTypes,
      pricingPolicy: movie.pricingPolicy
        ? {
            enabled: movie.pricingPolicy.enabled,
            minimumPrice: movie.pricingPolicy.minimumPrice,
            maximumPrice: movie.pricingPolicy.maximumPrice,
            rules: movie.pricingPolicy.rules.map((rule) => ({
              name: rule.name,
              type: rule.type,
            })),
          }
        : null,
      inventories: inventoriesWithDynamicPrice,
    },
  });
}

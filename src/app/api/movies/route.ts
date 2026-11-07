import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const movies = await prisma.event.findMany({
    where: { type: "MOVIE", status: "PUBLISHED", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: {
      venue: { select: { id: true, name: true, city: true } },
      ticketTypes: { select: { id: true, name: true, basePrice: true } },
      inventories: {
        where: { status: "AVAILABLE" },
        select: {
          currentPrice: true,
          status: true,
        },
      },
    },
  });
  return NextResponse.json({ movies });
}

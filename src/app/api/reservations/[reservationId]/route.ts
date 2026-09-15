import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(_request: Request, context: { params: Promise<{ reservationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view a reservation." }, { status: 401 });
  const { reservationId } = await context.params;
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, userId: user.id },
    include: {
      event: { select: { id: true, name: true, startTime: true, venue: { select: { name: true, city: true } } } },
      items: {
        select: {
          ticketInventory: {
            select: {
              id: true,
              currentPrice: true,
              seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } },
            },
          },
        },
      },
      order: { select: { id: true, status: true, totalAmount: true, items: { select: { ticket: { select: { ticketCode: true } } } } } },
    },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  return NextResponse.json({ reservation });
}

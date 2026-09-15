import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your tickets." }, { status: 401 });
  const orders = await prisma.order.findMany({
    where: { userId: user.id, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { name: true, startTime: true, venue: { select: { name: true, city: true } } } },
      items: { select: { unitPrice: true, ticket: { select: { ticketCode: true, status: true } }, ticketInventory: { select: { seat: { select: { rowNumber: true, seatNumber: true, section: { select: { name: true } } } } } } } },
    },
  });
  return NextResponse.json({ orders });
}

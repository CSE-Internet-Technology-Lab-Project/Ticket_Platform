import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrganizer } from "@/lib/current-user";

export async function POST(request: Request) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const rawCode = typeof body?.ticketCode === "string" ? body.ticketCode : "";
  const ticketCodes = Array.from(new Set<string>(rawCode.split(/[|,\s]+/).map((code: string) => code.trim().toUpperCase()).filter((code: string) => Boolean(code))));
  if (!ticketCodes.length) return NextResponse.json({ error: "Enter or scan a ticket QR code." }, { status: 400 });
  let result: { summaries: { code: string; guest: string; movie: string; cinema: string; seat: string }[]; checkedInAt: Date };
  try {
    result = await prisma.$transaction(async (tx) => {
      const tickets = await tx.ticket.findMany({
        where: { ticketCode: { in: ticketCodes }, orderItem: { order: { event: { organizerId: organizer.id } } } },
        include: { orderItem: { include: { order: { include: { event: { select: { name: true, venue: { select: { name: true } } } }, user: { select: { name: true } } } } } }, ticketInventory: { include: { seat: { include: { section: { select: { name: true } } } } } } },
      });
      if (tickets.length !== ticketCodes.length) throw new Error("TICKET_NOT_FOUND");
      const used = tickets.find((ticket) => ticket.status !== "ACTIVE");
      if (used) throw new Error(used.status === "USED" ? "TICKET_ALREADY_USED" : "TICKET_NOT_ACTIVE");
      const checkedInAt = new Date();
      const summaries = tickets.map((ticket) => ({ code: ticket.ticketCode, guest: ticket.orderItem.order.user.name, movie: ticket.orderItem.order.event.name, cinema: ticket.orderItem.order.event.venue.name, seat: `${String.fromCharCode(65 + ticket.ticketInventory.seat.rowNumber)}${ticket.ticketInventory.seat.seatNumber} · ${ticket.ticketInventory.seat.section.name}` }));
      const updated = await tx.ticket.updateMany({ where: { id: { in: tickets.map((ticket) => ticket.id) }, status: "ACTIVE" }, data: { status: "USED", usedAt: checkedInAt } });
      if (updated.count !== tickets.length) throw new Error("TICKET_ALREADY_USED");
      return { summaries, checkedInAt };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TICKET_NOT_FOUND") return NextResponse.json({ error: "Ticket not found in your showtimes." }, { status: 404 });
    if (message === "TICKET_ALREADY_USED") return NextResponse.json({ error: "This ticket was already checked in." }, { status: 409 });
    if (message === "TICKET_NOT_ACTIVE") return NextResponse.json({ error: "This ticket is not active and cannot be used." }, { status: 409 });
    return NextResponse.json({ error: "Ticket validation failed. Please try again." }, { status: 500 });
  }
  const first = result.summaries[0];
  return NextResponse.json({ ok: true, ticket: { code: ticketCodes.join("|"), count: result.summaries.length, guest: first.guest, movie: first.movie, cinema: first.cinema, seat: result.summaries.length === 1 ? first.seat : `${result.summaries.length} seats`, usedAt: result.checkedInAt } });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAllEvents, getOrganizer } from "@/lib/current-user";

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const inventoryId = typeof body?.inventoryId === "string" ? body.inventoryId : "";
  const status = body?.status;
  if (!inventoryId || (status !== "BLOCKED" && status !== "AVAILABLE")) return NextResponse.json({ error: "Select a seat and a valid action." }, { status: 400 });
  const updated = await prisma.ticketInventory.updateMany({ where: { id: inventoryId, eventId, ...(canManageAllEvents(organizer) ? {} : { event: { organizerId: organizer.id } }), status: status === "BLOCKED" ? "AVAILABLE" : "BLOCKED" }, data: { status, version: { increment: 1 } } });
  if (!updated.count) return NextResponse.json({ error: "Only available or manually blocked seats can be changed." }, { status: 409 });
  return NextResponse.json({ ok: true, status });
}

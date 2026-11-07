import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAllEvents, getOrganizer } from "@/lib/current-user";

function sanitizeUrl(url?: unknown): string | null | undefined {
  if (url === undefined) return undefined;
  if (url === null || url === "") return null;
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048 || !/^https?:\/\/\S+$|^\/\S+$/i.test(trimmed)) {
    throw new Error("INVALID_URL");
  }
  return trimmed;
}

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const description = typeof body?.description === "string" ? body.description.trim() || null : undefined;

  let imageUrl: string | null | undefined;
  let trailerImageUrl: string | null | undefined;
  let trailerUrl: string | null | undefined;

  try {
    imageUrl = sanitizeUrl(body?.imageUrl);
    trailerImageUrl = sanitizeUrl(body?.trailerImageUrl);
    trailerUrl = sanitizeUrl(body?.trailerUrl);
  } catch {
    return NextResponse.json({ error: "Image and trailer URLs must be valid HTTP/HTTPS links or local paths." }, { status: 400 });
  }

  const startTime = typeof body?.startTime === "string" ? new Date(body.startTime) : undefined;
  const venueName = typeof body?.venueName === "string" ? body.venueName.trim() : undefined;
  const city = typeof body?.city === "string" ? body.city.trim() : undefined;

  if (status !== undefined && status !== "DRAFT" && status !== "PUBLISHED" && status !== "CANCELLED") return NextResponse.json({ error: "Invalid event status." }, { status: 400 });
  if (name !== undefined && !name) return NextResponse.json({ error: "Movie title cannot be empty." }, { status: 400 });
  if (startTime && (Number.isNaN(startTime.getTime()) || startTime <= new Date())) return NextResponse.json({ error: "Choose a future showtime." }, { status: 400 });
  if (venueName !== undefined && !venueName) return NextResponse.json({ error: "Cinema name cannot be empty." }, { status: 400 });
  if (city !== undefined && !city) return NextResponse.json({ error: "City cannot be empty." }, { status: 400 });
  if ([status, name, description, imageUrl, trailerImageUrl, trailerUrl, startTime, venueName, city].every((value) => value === undefined)) return NextResponse.json({ error: "No changes were provided." }, { status: 400 });

  const existing = await prisma.event.findFirst({ where: { id: eventId, ...(canManageAllEvents(organizer) ? {} : { organizerId: organizer.id }) }, select: { id: true, startTime: true, endTime: true, venueId: true } });
  if (!existing) return NextResponse.json({ error: "Showtime not found." }, { status: 404 });
  const duration = existing.endTime.getTime() - existing.startTime.getTime();
  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: {
        ...(status ? { status } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(trailerImageUrl !== undefined ? { trailerImageUrl } : {}),
        ...(trailerUrl !== undefined ? { trailerUrl } : {}),
        ...(startTime ? { startTime, endTime: new Date(startTime.getTime() + duration) } : {}),
      },
    });
    if (venueName !== undefined || city !== undefined) await tx.venue.update({ where: { id: existing.venueId }, data: { ...(venueName !== undefined ? { name: venueName } : {}), ...(city !== undefined ? { city } : {}) } });
  });
  return NextResponse.json({ ok: true });
}

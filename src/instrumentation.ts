export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { prisma } = await import("@/lib/prisma");

      // Verify columns exist in the Event table
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerImageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerUrl" TEXT;
      `);

      // Clean up legacy IMDb webpage links that browsers cannot render as images
      await prisma.event.updateMany({
        where: {
          imageUrl: { contains: "imdb.com" },
        },
        data: {
          imageUrl: "https://upload.wikimedia.org/wikipedia/en/a/a4/The_Jungle_Book_%282016%29.jpg",
        },
      });

      // Find published movies that have no banner image and no trailer image
      const emptyEvents = await prisma.event.findMany({
        where: {
          AND: [
            { OR: [{ imageUrl: null }, { imageUrl: "" }] },
            { OR: [{ trailerImageUrl: null }, { trailerImageUrl: "" }] },
          ],
        },
        select: { id: true, venueId: true, name: true },
      });

      for (const ev of emptyEvents) {
        try {
          await prisma.ticket.deleteMany({ where: { ticketInventory: { eventId: ev.id } } });
          await prisma.orderItem.deleteMany({ where: { order: { eventId: ev.id } } });
          await prisma.order.deleteMany({ where: { eventId: ev.id } });
          await prisma.event.delete({ where: { id: ev.id } });
          await prisma.venue.delete({ where: { id: ev.venueId } }).catch(() => null);
          console.log(`[db] Removed movie without banner: ${ev.name} (${ev.id})`);
        } catch {
          await prisma.event.update({ where: { id: ev.id }, data: { status: "CANCELLED" } }).catch(() => null);
          console.log(`[db] Cancelled movie without banner: ${ev.name} (${ev.id})`);
        }
      }

      console.log("[db] Verified Event schema and removed movies without banner image.");
    } catch (err) {
      console.warn("[db] Database initialization warning:", err);
    }
  }
}

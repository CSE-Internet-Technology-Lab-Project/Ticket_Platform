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

      // Configure exclusive organizer account: name "org", email "org@gmail.com", password "12345678"
      const { hashPassword } = await import("@/lib/auth");
      const orgPasswordHash = await hashPassword("12345678");

      const existingOrg = await prisma.user.findUnique({
        where: { email: "org@gmail.com" },
      });

      let orgUserId = existingOrg?.id;

      if (existingOrg) {
        await prisma.user.update({
          where: { id: existingOrg.id },
          data: {
            name: "org",
            passwordHash: orgPasswordHash,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });
      } else {
        const createdOrg = await prisma.user.create({
          data: {
            name: "org",
            email: "org@gmail.com",
            passwordHash: orgPasswordHash,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });
        orgUserId = createdOrg.id;
      }

      // Demote all other users to USER so org@gmail.com is the ONLY organizer/admin
      if (orgUserId) {
        await prisma.user.updateMany({
          where: {
            id: { not: orgUserId },
            role: { in: ["ORGANIZER", "ADMIN"] },
          },
          data: {
            role: "USER",
          },
        });

        // Ensure all events and venues belong to this organizer
        await prisma.event.updateMany({
          data: {
            organizerId: orgUserId,
          },
        });
        await prisma.venue.updateMany({
          data: {
            createdById: orgUserId,
          },
        });
      }

      console.log("[db] Exclusive organizer account configured: org (org@gmail.com).");
    } catch (err) {
      console.warn("[db] Database initialization warning:", err);
    }
  }
}

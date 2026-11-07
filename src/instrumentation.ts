export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerImageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerUrl" TEXT;
      `);
      // Update any legacy IMDb webpage links that cannot be rendered by browsers
      await prisma.event.updateMany({
        where: {
          imageUrl: { contains: "imdb.com" },
        },
        data: {
          imageUrl: "https://upload.wikimedia.org/wikipedia/en/a/a4/The_Jungle_Book_%282016%29.jpg",
        },
      });
      console.log("[db] Verified Event table image columns and cleaned legacy links.");
    } catch (err) {
      console.warn("[db] Column migration check skipped or failed:", err);
    }
  }
}

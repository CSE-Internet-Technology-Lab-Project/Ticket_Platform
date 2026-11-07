export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerImageUrl" TEXT;
        ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "trailerUrl" TEXT;
      `);
      console.log("[db] Verified Event table image and trailer columns.");
    } catch (err) {
      console.warn("[db] Column migration check skipped or failed:", err);
    }
  }
}

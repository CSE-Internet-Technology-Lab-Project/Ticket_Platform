import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSession, session, type SessionUser } from "@/lib/auth";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = readSession((await cookies()).get(session.name)?.value);
  if (!token) return null;

  // Do not trust a long-lived cookie alone: account blocks and role changes take
  // effect on the next protected request.
  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getOrganizer() {
  const user = await getCurrentUser();
  return user?.role === "ORGANIZER" ? user : null;
}

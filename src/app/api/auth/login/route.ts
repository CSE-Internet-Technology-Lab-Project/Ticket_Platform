import { NextResponse } from "next/server";
import { createSession, session, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, status: true, passwordHash: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (user.status === "BLOCKED") return NextResponse.json({ error: "This account has been blocked. Contact support for help." }, { status: 403 });
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  const response = NextResponse.json({ user: safeUser });
  response.cookies.set(session.name, createSession(safeUser), session.options);
  return response;
}

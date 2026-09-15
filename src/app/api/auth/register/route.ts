import { NextResponse } from "next/server";
import { hashPassword, createSession, session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role === "ORGANIZER" ? "ORGANIZER" : "USER";
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return NextResponse.json({ error: "Enter a name, valid email, and a password of at least 8 characters." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password), role }, select: { id: true, name: true, email: true, role: true } });
  const response = NextResponse.json({ user });
  response.cookies.set(session.name, createSession(user), session.options);
  return response;
}

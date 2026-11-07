import { NextResponse } from "next/server";
import { hashPassword, createSession, session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  // Always enforce USER role on public registration to prevent privilege escalation
  const role = "USER" as const;

  if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 255 || password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "Enter a valid name, email, and a password between 8 and 72 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role },
    select: { id: true, name: true, email: true, role: true },
  });

  const response = NextResponse.json({ user });
  response.cookies.set(session.name, createSession(user), session.options);
  return response;
}

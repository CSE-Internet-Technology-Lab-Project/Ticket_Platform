import { NextResponse } from "next/server";
import { session } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(session.name, "", { ...session.options, maxAge: 0 });
  return response;
}

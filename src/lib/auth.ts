import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const sessionCookie = "ticketly_session";

export type SessionUser = { id: string; name: string; email: string; role: "USER" | "ORGANIZER" };
type SessionPayload = SessionUser & { exp: number };

function secret() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET must be set in production.");
  }
  return process.env.AUTH_SECRET ?? "development-only-secret-change-me";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, savedKey] = stored.split(":");
  if (!salt || !savedKey) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const saved = Buffer.from(savedKey, "hex");
  return saved.length === key.length && timingSafeEqual(saved, key);
}

export function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + session.options.maxAge })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSession(value?: string): SessionUser | null {
  if (!value) return null;
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!parsed.id || !parsed.email || !parsed.name || !parsed.role || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: parsed.id, name: parsed.name, email: parsed.email, role: parsed.role };
  } catch {
    return null;
  }
}

export const session = {
  name: sessionCookie,
  options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 },
};

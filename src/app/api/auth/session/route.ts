import { getCurrentUser } from "@/lib/current-user";

export async function GET() {
  return Response.json({ user: await getCurrentUser() });
}

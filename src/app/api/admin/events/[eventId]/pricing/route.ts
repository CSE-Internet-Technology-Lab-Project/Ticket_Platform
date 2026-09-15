import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrganizer } from "@/lib/current-user";

const types = new Set(["INVENTORY", "DEMAND", "TIME", "WEEKEND", "EARLY_BIRD", "LAST_MINUTE"]);
const adjustmentTypes = new Set(["PERCENTAGE", "FIXED_AMOUNT", "MULTIPLIER"]);

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.json({ error: "Organizer access is required." }, { status: 403 });
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : undefined;
  const minimumPrice = Number(body?.minimumPrice);
  const maximumPrice = Number(body?.maximumPrice);
  const rules: unknown[] | null = Array.isArray(body?.rules) ? body.rules : null;
  if (enabled === undefined || !Number.isFinite(minimumPrice) || !Number.isFinite(maximumPrice) || minimumPrice < 0 || maximumPrice < minimumPrice || !rules) return NextResponse.json({ error: "Provide valid pricing limits and rules." }, { status: 400 });
  const event = await prisma.event.findFirst({ where: { id: eventId, organizerId: organizer.id }, select: { id: true, ticketTypes: { select: { id: true } } } });
  if (!event) return NextResponse.json({ error: "Showtime not found." }, { status: 404 });
  const ticketTypeIds = new Set(event.ticketTypes.map((ticketType) => ticketType.id));
  const validRules = rules.map((rawRule) => { const rule = rawRule as Record<string, unknown>; return { id: typeof rule.id === "string" ? rule.id : undefined, name: typeof rule.name === "string" ? rule.name.trim() : "", type: rule.type, adjustmentType: rule.adjustmentType, adjustmentValue: Number(rule.adjustmentValue), conditions: rule.conditions && typeof rule.conditions === "object" ? rule.conditions : {}, priority: Number(rule.priority), enabled: typeof rule.enabled === "boolean" ? rule.enabled : true, ticketTypeId: typeof rule.ticketTypeId === "string" ? rule.ticketTypeId : null }; });
  if (validRules.some((rule) => !rule.name || typeof rule.type !== "string" || typeof rule.adjustmentType !== "string" || !types.has(rule.type) || !adjustmentTypes.has(rule.adjustmentType) || !Number.isFinite(rule.adjustmentValue) || !Number.isFinite(rule.priority) || (rule.ticketTypeId && !ticketTypeIds.has(rule.ticketTypeId)))) return NextResponse.json({ error: "One or more pricing rules are invalid." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    const policy = await tx.pricingPolicy.upsert({ where: { eventId }, create: { eventId, enabled, minimumPrice, maximumPrice }, update: { enabled, minimumPrice, maximumPrice } });
    const retainedIds = validRules.flatMap((rule) => rule.id ? [rule.id] : []);
    await tx.pricingRule.deleteMany({ where: { policyId: policy.id, id: { notIn: retainedIds } } });
    for (const rule of validRules) {
      const data = { name: rule.name, type: rule.type as "INVENTORY" | "DEMAND" | "TIME" | "WEEKEND" | "EARLY_BIRD" | "LAST_MINUTE", adjustmentType: rule.adjustmentType as "PERCENTAGE" | "FIXED_AMOUNT" | "MULTIPLIER", adjustmentValue: rule.adjustmentValue, conditions: rule.conditions as Prisma.InputJsonValue, priority: Math.round(rule.priority), enabled: rule.enabled, ticketTypeId: rule.ticketTypeId };
      if (rule.id) await tx.pricingRule.updateMany({ where: { id: rule.id, policyId: policy.id }, data });
      else await tx.pricingRule.create({ data: { policyId: policy.id, ...data } });
    }
  });
  return NextResponse.json({ ok: true });
}

type PricingRule = {
  ticketTypeId?: string | null;
  name: string;
  type: "INVENTORY" | "DEMAND" | "TIME" | "WEEKEND" | "EARLY_BIRD" | "LAST_MINUTE";
  adjustmentType: "PERCENTAGE" | "FIXED_AMOUNT" | "MULTIPLIER";
  adjustmentValue: { toNumber(): number };
  conditions: unknown;
  priority: number;
};

function numericCondition(conditions: unknown, key: string) {
  if (!conditions || typeof conditions !== "object") return undefined;
  const value = (conditions as Record<string, unknown>)[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

export type PricingContext = { remainingPercentage: number; hoursUntilEvent: number; isWeekend: boolean; ticketTypeId?: string };

export function calculateDynamicPrice(basePrice: number, rules: PricingRule[], context: PricingContext, bounds?: { minimum?: number | null; maximum?: number | null }) {
  let price = basePrice;
  const reasons: string[] = [];
  for (const rule of [...rules].sort((a, b) => b.priority - a.priority)) {
    const threshold = numericCondition(rule.conditions, "remainingPercentage");
    const hoursBefore = numericCondition(rule.conditions, "hoursBefore");
    const minimumHours = numericCondition(rule.conditions, "minimumHoursBefore");
    const appliesToTicket = !rule.ticketTypeId || rule.ticketTypeId === context.ticketTypeId;
    const applies = appliesToTicket && (
      ((rule.type === "INVENTORY" || rule.type === "DEMAND") && threshold !== undefined && context.remainingPercentage <= threshold) ||
      ((rule.type === "TIME" || rule.type === "LAST_MINUTE") && hoursBefore !== undefined && context.hoursUntilEvent <= hoursBefore) ||
      (rule.type === "EARLY_BIRD" && minimumHours !== undefined && context.hoursUntilEvent >= minimumHours) ||
      (rule.type === "WEEKEND" && context.isWeekend)
    );
    if (!applies) continue;
    const adjustment = rule.adjustmentValue.toNumber();
    if (!Number.isFinite(adjustment)) continue;
    price = rule.adjustmentType === "PERCENTAGE" ? price * (1 + adjustment / 100) : rule.adjustmentType === "MULTIPLIER" ? price * adjustment : price + adjustment;
    reasons.push(rule.name);
  }
  const clamped = Math.min(bounds?.maximum ?? Number.POSITIVE_INFINITY, Math.max(bounds?.minimum ?? 0, price));
  return { price: Math.round(clamped * 100) / 100, reasons };
}

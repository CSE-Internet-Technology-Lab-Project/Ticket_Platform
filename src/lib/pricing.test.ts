import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateDynamicPrice, type PricingContext } from "./pricing";

describe("Dynamic Pricing Engine", () => {
  const baseContext: PricingContext = {
    remainingPercentage: 50,
    hoursUntilEvent: 48,
    isWeekend: false,
    ticketTypeId: "classic-tier",
  };

  it("should return base price when no rules are configured", () => {
    const result = calculateDynamicPrice(200, [], baseContext);
    assert.equal(result.price, 200);
    assert.deepEqual(result.reasons, []);
  });

  it("should increase price when inventory drops below threshold (scarcity pricing)", () => {
    const rules = [
      {
        name: "Low Inventory Surge (+20%)",
        type: "INVENTORY" as const,
        adjustmentType: "PERCENTAGE" as const,
        adjustmentValue: { toNumber: () => 20 },
        conditions: { remainingPercentage: 30 },
        priority: 1,
      },
    ];

    // Case 1: Inventory is 40% (above 30% threshold) -> No surge
    const normal = calculateDynamicPrice(250, rules, { ...baseContext, remainingPercentage: 40 });
    assert.equal(normal.price, 250);
    assert.equal(normal.reasons.length, 0);

    // Case 2: Inventory is 20% (below 30% threshold) -> +20% surge (250 * 1.20 = 300)
    const surged = calculateDynamicPrice(250, rules, { ...baseContext, remainingPercentage: 20 });
    assert.equal(surged.price, 300);
    assert.ok(surged.reasons.includes("Low Inventory Surge (+20%)"));
  });

  it("should apply last-minute surge when event is within specified hours", () => {
    const rules = [
      {
        name: "Last Minute Fee (+₹50)",
        type: "LAST_MINUTE" as const,
        adjustmentType: "FIXED_AMOUNT" as const,
        adjustmentValue: { toNumber: () => 50 },
        conditions: { hoursBefore: 6 },
        priority: 2,
      },
    ];

    // 12 hours before showtime -> No fee
    const early = calculateDynamicPrice(300, rules, { ...baseContext, hoursUntilEvent: 12 });
    assert.equal(early.price, 300);

    // 3 hours before showtime -> +₹50 fee
    const late = calculateDynamicPrice(300, rules, { ...baseContext, hoursUntilEvent: 3 });
    assert.equal(late.price, 350);
    assert.ok(late.reasons.includes("Last Minute Fee (+₹50)"));
  });

  it("should apply weekend multiplier", () => {
    const rules = [
      {
        name: "Weekend Prime (1.15x)",
        type: "WEEKEND" as const,
        adjustmentType: "MULTIPLIER" as const,
        adjustmentValue: { toNumber: () => 1.15 },
        conditions: {},
        priority: 1,
      },
    ];

    const weekday = calculateDynamicPrice(400, rules, { ...baseContext, isWeekend: false });
    assert.equal(weekday.price, 400);

    const weekend = calculateDynamicPrice(400, rules, { ...baseContext, isWeekend: true });
    assert.equal(weekend.price, 460); // 400 * 1.15 = 460
  });

  it("should clamp prices to configured maximum and minimum bounds", () => {
    const aggressiveRules = [
      {
        name: "Extreme Demand (+100%)",
        type: "INVENTORY" as const,
        adjustmentType: "PERCENTAGE" as const,
        adjustmentValue: { toNumber: () => 100 },
        conditions: { remainingPercentage: 10 },
        priority: 10,
      },
    ];

    // Without cap: 400 * 2 = 800. With cap of 600: clamped to 600
    const clampedMax = calculateDynamicPrice(
      400,
      aggressiveRules,
      { ...baseContext, remainingPercentage: 5 },
      { minimum: 150, maximum: 600 }
    );
    assert.equal(clampedMax.price, 600);

    // Discount rule attempting to lower below minimum
    const discountRules = [
      {
        name: "Super Early Bird (-₹200)",
        type: "EARLY_BIRD" as const,
        adjustmentType: "FIXED_AMOUNT" as const,
        adjustmentValue: { toNumber: () => -200 },
        conditions: { minimumHoursBefore: 72 },
        priority: 1,
      },
    ];

    // Base 250 - 200 = 50. With minimum bound 150: clamped to 150
    const clampedMin = calculateDynamicPrice(
      250,
      discountRules,
      { ...baseContext, hoursUntilEvent: 96 },
      { minimum: 150, maximum: 600 }
    );
    assert.equal(clampedMin.price, 150);
  });

  it("should apply rule strictly to matching ticketTypeId", () => {
    const rules = [
      {
        name: "VIP Lounge Fee",
        ticketTypeId: "vip-recliner",
        type: "WEEKEND" as const,
        adjustmentType: "FIXED_AMOUNT" as const,
        adjustmentValue: { toNumber: () => 100 },
        conditions: {},
        priority: 1,
      },
    ];

    // Context with classic-tier -> Should NOT apply
    const classic = calculateDynamicPrice(250, rules, { ...baseContext, isWeekend: true, ticketTypeId: "classic-tier" });
    assert.equal(classic.price, 250);

    // Context with vip-recliner -> MUST apply
    const vip = calculateDynamicPrice(500, rules, { ...baseContext, isWeekend: true, ticketTypeId: "vip-recliner" });
    assert.equal(vip.price, 600);
  });

  it("should evaluate rules in order of priority (highest first)", () => {
    const rules = [
      {
        name: "Priority 1 (Add 10)",
        type: "WEEKEND" as const,
        adjustmentType: "FIXED_AMOUNT" as const,
        adjustmentValue: { toNumber: () => 10 },
        conditions: {},
        priority: 1,
      },
      {
        name: "Priority 10 (Double)",
        type: "WEEKEND" as const,
        adjustmentType: "MULTIPLIER" as const,
        adjustmentValue: { toNumber: () => 2 },
        conditions: {},
        priority: 10,
      },
    ];

    // Base 100 -> Priority 10 doubles first (100 * 2 = 200) -> Priority 1 adds 10 (200 + 10 = 210)
    const result = calculateDynamicPrice(100, rules, { ...baseContext, isWeekend: true });
    assert.equal(result.price, 210);
    assert.deepEqual(result.reasons, ["Priority 10 (Double)", "Priority 1 (Add 10)"]);
  });
});

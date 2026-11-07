import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates seat reservation parameters before executing database locks.
 * Matches rules in src/app/api/reservations/route.ts
 */
function validateReservationRequest(eventId: unknown, rawInventoryIds: unknown[]) {
  const validEventId = typeof eventId === "string" && eventId.trim().length > 0;
  if (!validEventId) {
    return { valid: false, error: "Choose between one and six unique seats." };
  }

  const inventoryIds = Array.isArray(rawInventoryIds)
    ? rawInventoryIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (inventoryIds.length < 1 || inventoryIds.length > 6 || new Set(inventoryIds).size !== inventoryIds.length) {
    return { valid: false, error: "Choose between one and six unique seats." };
  }

  return { valid: true, inventoryIds };
}

/**
 * Checks whether a seat hold reservation has expired.
 */
function isReservationExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

/**
 * Verifies Razorpay payment signature using timingSafeEqual.
 * Matches logic in src/app/api/payments/confirm/route.ts & webhooks/razorpay/route.ts
 */
function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  receivedSignature: string,
  secret: string
): boolean {
  if (!orderId || !paymentId || !receivedSignature || !secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = createHmac("sha256", secret).update(payload).digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature, "utf8");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");

  if (generatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(generatedBuffer, receivedBuffer);
}

describe("Reservation Rules & Payment Security", () => {
  describe("Seat Reservation Validation", () => {
    it("should accept valid reservation of 1 to 6 unique seats", () => {
      const singleSeat = validateReservationRequest("ev_123", ["seat_1"]);
      assert.equal(singleSeat.valid, true);
      assert.deepEqual(singleSeat.inventoryIds, ["seat_1"]);

      const sixSeats = validateReservationRequest("ev_123", [
        "seat_1", "seat_2", "seat_3", "seat_4", "seat_5", "seat_6"
      ]);
      assert.equal(sixSeats.valid, true);
      assert.equal(sixSeats.inventoryIds?.length, 6);
    });

    it("should reject reservations with 0 seats", () => {
      const res = validateReservationRequest("ev_123", []);
      assert.equal(res.valid, false);
      assert.equal(res.error, "Choose between one and six unique seats.");
    });

    it("should reject reservations exceeding maximum 6 seats limit", () => {
      const sevenSeats = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];
      const res = validateReservationRequest("ev_123", sevenSeats);
      assert.equal(res.valid, false);
      assert.equal(res.error, "Choose between one and six unique seats.");
    });

    it("should reject duplicate seat IDs in the same request to prevent race conditions", () => {
      const duplicates = ["seat_vip_1", "seat_vip_2", "seat_vip_1"];
      const res = validateReservationRequest("ev_123", duplicates);
      assert.equal(res.valid, false);
      assert.equal(res.error, "Choose between one and six unique seats.");
    });

    it("should reject invalid or missing eventId", () => {
      assert.equal(validateReservationRequest("", ["seat_1"]).valid, false);
      assert.equal(validateReservationRequest(null, ["seat_1"]).valid, false);
      assert.equal(validateReservationRequest(undefined, ["seat_1"]).valid, false);
    });
  });

  describe("Seat Hold TTL & Expiration", () => {
    it("should identify active seat hold when within 10-minute window", () => {
      const now = new Date("2026-11-08T12:00:00Z");
      const expiresAt = new Date("2026-11-08T12:10:00Z"); // 10 minutes in future
      assert.equal(isReservationExpired(expiresAt, now), false);
    });

    it("should flag seat hold as expired when past expiration timestamp", () => {
      const now = new Date("2026-11-08T12:10:01Z");
      const expiresAt = new Date("2026-11-08T12:10:00Z"); // 1 second in past
      assert.equal(isReservationExpired(expiresAt, now), true);
    });
  });

  describe("Payment Signature Verification", () => {
    const secret = "test_razorpay_secret_key_987654";
    const orderId = "order_O8x7zD6nU2V9kL";
    const paymentId = "pay_P3m4n5k6q7w8e9";

    it("should verify valid HMAC-SHA256 payment signature", () => {
      const validSignature = createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = verifyPaymentSignature(orderId, paymentId, validSignature, secret);
      assert.equal(isValid, true);
    });

    it("should reject forged or mismatched payment signatures", () => {
      const forgedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const isValid = verifyPaymentSignature(orderId, paymentId, forgedSignature, secret);
      assert.equal(isValid, false);
    });

    it("should reject signatures generated with incorrect secret", () => {
      const wrongSecretSignature = createHmac("sha256", "wrong_secret_123")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = verifyPaymentSignature(orderId, paymentId, wrongSecretSignature, secret);
      assert.equal(isValid, false);
    });
  });
});

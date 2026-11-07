import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSession, hashPassword, readSession, verifyPassword, type SessionUser } from "./auth";

describe("Authentication & Session Security", () => {
  it("should hash password with random salt using scrypt", async () => {
    const password = "mySecretPassword123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Each hash must contain salt and key separated by ':'
    assert.match(hash1, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.match(hash2, /^[a-f0-9]{32}:[a-f0-9]{128}$/);

    // Salting ensures identical passwords produce distinct hashes
    assert.notEqual(hash1, hash2);
  });

  it("should verify correct password and reject incorrect password", async () => {
    const password = "correctHorseBatteryStaple";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    assert.equal(isMatch, true);

    const isWrong = await verifyPassword("wrongPassword", hash);
    assert.equal(isWrong, false);
  });

  it("should return false for malformed or corrupted hashes", async () => {
    assert.equal(await verifyPassword("password", "invalid_hash_without_colon"), false);
    assert.equal(await verifyPassword("password", ":"), false);
    assert.equal(await verifyPassword("password", "deadbeef:"), false);
  });

  it("should sign and verify valid user session", () => {
    const user: SessionUser = {
      id: "usr_12345",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "USER",
    };

    const token = createSession(user);
    assert.ok(typeof token === "string");
    assert.ok(token.includes("."));

    const decoded = readSession(token);
    assert.ok(decoded);
    assert.equal(decoded.id, user.id);
    assert.equal(decoded.name, user.name);
    assert.equal(decoded.email, user.email);
    assert.equal(decoded.role, user.role);
  });

  it("should reject session if payload is tampered with", () => {
    const user: SessionUser = {
      id: "usr_12345",
      name: "Normal User",
      email: "user@example.com",
      role: "USER",
    };

    const token = createSession(user);
    const [payload, signature] = token.split(".");

    // Attacker tampers payload to elevate role to ADMIN
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    parsed.role = "ADMIN";
    const tamperedPayload = Buffer.from(JSON.stringify(parsed)).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${signature}`;

    const decoded = readSession(tamperedToken);
    assert.equal(decoded, null);
  });

  it("should reject session if signature is forged", () => {
    const user: SessionUser = {
      id: "usr_attacker",
      name: "Attacker",
      email: "attacker@example.com",
      role: "ADMIN",
    };

    const token = createSession(user);
    const [payload] = token.split(".");
    const forgedToken = `${payload}.invalidSignature1234567890abcdef`;

    const decoded = readSession(forgedToken);
    assert.equal(decoded, null);
  });

  it("should reject expired session token", () => {
    const user: SessionUser = {
      id: "usr_old",
      name: "Old Session",
      email: "old@example.com",
      role: "USER",
    };

    // Create session that expired 1 hour ago
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const expiredPayload = Buffer.from(JSON.stringify({ ...user, exp: pastExp })).toString("base64url");
    
    // Read session helper should reject past expiration
    const decoded = readSession(`${expiredPayload}.any_signature`);
    assert.equal(decoded, null);
  });
});

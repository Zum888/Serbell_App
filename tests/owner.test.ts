import { expect, it } from "vitest";
import type { VerifiedIdentity } from "../cursor/identity";
import { isDemoOwner } from "@/server/owner";

const person = (userId: number, simulated = false): VerifiedIdentity => ({
  verified: true,
  simulated,
  token: "",
  sub: simulated ? "user:dev" : `user:${userId}`,
  email: "dev@example.com",
  emailVerified: true,
  name: "Dev",
  idp: { provider: "cursor", sub: String(userId) },
  stage: "production",
  expiresAt: new Date("2026-12-01T00:00:00.000Z"),
  claims: {},
  kind: "person",
  userId,
  appVisibility: "private",
});

const apiKey = (): VerifiedIdentity => ({
  verified: true,
  simulated: false,
  token: "",
  sub: "key:1",
  email: "",
  emailVerified: false,
  name: "ci-key",
  idp: { provider: "cursor", sub: "1" },
  stage: "production",
  expiresAt: new Date("2026-12-01T00:00:00.000Z"),
  claims: {},
  kind: "key",
  ownerUserId: 1,
  appVisibility: "private",
});

it("admits the local simulated viewer and any verified signed-in person", () => {
  expect(isDemoOwner(person(0, true))).toBe(true);
  expect(isDemoOwner(person(358083753))).toBe(true);
  expect(isDemoOwner(person(1))).toBe(true);
});

it("refuses non-interactive API keys", () => {
  expect(isDemoOwner(apiKey())).toBe(false);
});

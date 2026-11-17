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

it("lets the local simulated viewer and the app owner switch profiles", () => {
  expect(isDemoOwner(person(0, true))).toBe(true);
  expect(isDemoOwner(person(358083753))).toBe(true);
  expect(isDemoOwner(person(1))).toBe(false);
});

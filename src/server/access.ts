import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity";

const ACCESS_COOKIE = "sb_access";
const ACCESS_PURPOSE = "serbell-access-v1";

/**
 * The shared password that protects the published lab. It is read from the
 * environment and is never written into the files the app ships (a hardcoded
 * password would be a security finding). Set it in the app's secret settings
 * in Cursor as SERBELL_ACCESS_PASSWORD. When it is unset the gate fails closed.
 */
function configuredPassword(): string | null {
  const value = process.env.SERBELL_ACCESS_PASSWORD;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The gate only applies to the deployed app. On a local machine (npm run dev)
 * the lab stays open with no password, so design work has no friction.
 */
export function gateEnforced(): boolean {
  return process.env.NODE_ENV === "production";
}

/** The opaque cookie value proving the visitor typed the right password. */
function accessToken(password: string): string {
  return createHmac("sha256", password).update(ACCESS_PURPOSE).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Whether a password gate stands between the visitor and the lab right now. */
export function accessGateActive(): boolean {
  return gateEnforced();
}

/** Whether the app owner has configured the access password yet. */
export function accessConfigured(): boolean {
  return configuredPassword() !== null;
}

/** True when the current request may use the lab. */
export async function hasAccess(): Promise<boolean> {
  if (!gateEnforced()) return true;
  // A viewer that Cursor itself signed in does not need the shared password. A
  // signed-in person identity only exists on a Private or Team app, where the
  // platform has already restricted access to the owner and the people they
  // invite; a Public app never carries one, so there the password always applies.
  const identity = await getIdentity(await headers());
  if (identity.verified && identity.kind === "person") return true;
  const password = configuredPassword();
  if (!password) return false;
  const cookie = (await cookies()).get(ACCESS_COOKIE)?.value;
  return typeof cookie === "string" && safeEqual(cookie, accessToken(password));
}

/** Validate a submitted password against the configured one. */
export function passwordMatches(candidate: string): boolean {
  const password = configuredPassword();
  if (!password) return false;
  return safeEqual(candidate, password);
}

/** The cookie to set once the visitor passes the gate; null when unconfigured. */
export function grantCookie(): { name: string; value: string } | null {
  const password = configuredPassword();
  if (!password) return null;
  return { name: ACCESS_COOKIE, value: accessToken(password) };
}

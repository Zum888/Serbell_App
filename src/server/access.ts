import { cookies, headers } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity";

const ACCESS_COOKIE = "sb_access";
const ACCESS_PURPOSE = "serbell-access-v1";
const VISITOR_ID = /^[a-f0-9]{32}$/;
const MIN_PASSWORD_LENGTH = 12;

/**
 * A public lab cannot rest on a short or repetitive secret. Anything weaker
 * is treated as unset, so the gate stays closed.
 */
export function passwordAccepted(value: string): boolean {
  if (value.length < MIN_PASSWORD_LENGTH) return false;
  return new Set(value).size >= 4;
}

function rawPassword(): string {
  const value = process.env.SERBELL_ACCESS_PASSWORD;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The shared password that protects the published lab. It is read from the
 * environment and is never written into the files the app ships (a hardcoded
 * password would be a security finding). Set it in the app's secret settings
 * in Cursor as SERBELL_ACCESS_PASSWORD. When it is unset or too weak the gate
 * fails closed.
 */
function configuredPassword(): string | null {
  const value = rawPassword();
  return passwordAccepted(value) ? value : null;
}

/**
 * The gate only applies to the deployed app. On a local machine (npm run dev)
 * the lab stays open with no password, so design work has no friction.
 */
export function gateEnforced(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Signs one browser's visitor id. The same password does not yield the same cookie. */
function signVisitor(password: string, visitorId: string): string {
  return createHmac("sha256", password).update(`${ACCESS_PURPOSE}:${visitorId}`).digest("hex");
}

/**
 * The visitor id carried by a valid access cookie, or null when the cookie is
 * missing, forged, or still the old shared token. A shared token is rejected
 * so every browser is forced onto its own id.
 */
export function readSignedVisitor(cookieValue: string | undefined): string | null {
  const password = configuredPassword();
  if (!password || !cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const visitorId = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  if (!VISITOR_ID.test(visitorId) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = signVisitor(password, visitorId);
  if (!safeEqual(signature, expected)) return null;
  return visitorId;
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

/** Whether the app owner has configured an acceptable access password yet. */
export function accessConfigured(): boolean {
  return configuredPassword() !== null;
}

/** True when a secret is present but too easy to guess, so the gate stays shut. */
export function accessSecretTooWeak(): boolean {
  const value = rawPassword();
  return value.length > 0 && !passwordAccepted(value);
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
  return readSignedVisitor(cookie) !== null;
}

/** Validate a submitted password against the configured one. */
export function passwordMatches(candidate: string): boolean {
  const password = configuredPassword();
  if (!password) return false;
  return safeEqual(candidate, password);
}

/**
 * The cookie to set once the visitor passes the gate. A browser that already
 * has a valid cookie keeps its visitor id. Anyone else receives a new random
 * id. Null when the password is not configured.
 */
export function grantCookie(currentValue?: string | null): { name: string; value: string } | null {
  const password = configuredPassword();
  if (!password) return null;
  const visitorId = readSignedVisitor(currentValue ?? undefined) ?? randomBytes(16).toString("hex");
  return { name: ACCESS_COOKIE, value: `${visitorId}.${signVisitor(password, visitorId)}` };
}

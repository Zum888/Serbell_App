import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";

/** True when the caller (a fetch from our client code) wants a JSON answer instead of a redirect. */
export function wantsJson(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("application/json");
}

function firstHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!host || /[\s/\\@]/.test(host)) return null;
  return host;
}

/** A host we are willing to put in a redirect. Client-supplied names outside this list are ignored. */
export function trustedHost(value: string | null): string | null {
  const host = firstHost(value);
  if (!host) return null;
  const name = host.replace(/:\d+$/, "");
  if (name === "localhost" || name === "127.0.0.1") return host;
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.apps\.grok\.bot$/.test(name)) return host;
  return null;
}

/**
 * The public origin for redirects. Next's request.url is often an internal
 * localhost, so a trusted forwarded host is used when the platform sets one.
 * An arbitrary x-forwarded-host is ignored.
 */
export function originOf(req: Request) {
  const url = new URL(req.url);
  const host = trustedHost(req.headers.get("x-forwarded-host")) ?? trustedHost(req.headers.get("host")) ?? url.host;
  const name = host.replace(/:\d+$/, "");
  const proto = name.endsWith(".apps.grok.bot") ? "https:" : url.protocol;
  return `${proto}//${host}`;
}

export function redirectTo(req: Request, path: string, error?: string) {
  const url = new URL(path, `${originOf(req)}/`);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export function redirectError(req: Request, path: string, error: unknown) {
  if (isAppError(error)) return redirectTo(req, path, error.message);
  throw error;
}

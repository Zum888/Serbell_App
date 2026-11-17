import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";

/** Keep the host the browser used. Next's request.url is often localhost even for 127.0.0.1. */
export function originOf(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${url.protocol}//${host}` : url.origin;
}

export function redirectTo(req: Request, path: string, error?: string) {
  const url = new URL(path, `${originOf(req)}/`);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export function redirectError(req: Request, path: string, error: unknown) {
  if (isAppError(error) && (error.status === 401 || error.status === 403)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "cache-control": "private, no-store" } },
    );
  }
  if (isAppError(error)) return redirectTo(req, path, error.message);
  throw error;
}

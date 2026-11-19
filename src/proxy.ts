import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requestIsSameOrigin } from "@/server/same-origin";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The lab manages its own access: a password gate (src/server/access.ts) and a
 * self-contained demo session, both enforced in the Node runtime where the
 * secret is reliably available. Here we mark responses private and refuse a
 * state-changing API call that a browser made from another site.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && MUTATING.has(request.method) && !requestIsSameOrigin(request.headers)) {
    const response = NextResponse.json(
      { error: "La solicitud no viene de este laboratorio.", code: "CROSS_SITE" },
      { status: 403 },
    );
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  if (!request.cookies.get("sb_gate")?.value) {
    response.cookies.set("sb_gate", randomBytes(16).toString("hex"), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 12,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

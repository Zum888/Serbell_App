import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { VISITOR_COOKIE, VISITOR_HEADER, VISITOR_ID } from "@/lib/visitor";
import { requestIsSameOrigin } from "@/server/same-origin";

function randomVisitorId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Runs on every matched request. Refuses a state-changing API call that a
 * browser made from another site, and gives each browser its own demo id.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && MUTATING.has(request.method) && !requestIsSameOrigin(request.headers)) {
    const response = NextResponse.json(
      { error: "La solicitud no viene de este laboratorio.", code: "CROSS_SITE" },
      { status: 403 },
    );
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  const existing = request.cookies.get(VISITOR_COOKIE)?.value?.trim().toLowerCase() ?? "";
  const visitor = VISITOR_ID.test(existing) ? existing : randomVisitorId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(VISITOR_HEADER, visitor);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("cache-control", "private, no-store");
  if (existing !== visitor) {
    response.cookies.set(VISITOR_COOKIE, visitor, {
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

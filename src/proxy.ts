import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The lab manages its own access: a password gate (src/server/access.ts) and a
 * self-contained demo session, both enforced in the Node runtime where the
 * secret is reliably available. Here we only mark responses private and
 * uncacheable so a shared cache never serves one visitor's data to another.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

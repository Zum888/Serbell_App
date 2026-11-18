import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The lab is a self-contained demo: it manages its own per-viewer session and
 * admits every visitor (on a Private or Team deployment, Cursor's platform has
 * already restricted who can reach the app). We only mark responses as private
 * and uncacheable so a shared cache never serves one viewer's data to another.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireIdentity } from "../cursor/identity";
import { isDemoOwner } from "@/server/owner";

export async function proxy(request: NextRequest) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    return new NextResponse(null, {
      status: 401,
      headers: { "cache-control": "private, no-store" },
    });
  }
  if (!isDemoOwner(identity)) {
    return new NextResponse(null, {
      status: 403,
      headers: { "cache-control": "private, no-store" },
    });
  }
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

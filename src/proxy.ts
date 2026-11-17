import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireIdentity } from "../cursor/identity";

export async function proxy(request: NextRequest) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    return new NextResponse(null, {
      status: 401,
      headers: { "cache-control": "private, no-store" },
    });
  }
  if (!request.nextUrl.pathname.startsWith("/api") && !request.cookies.get("serbell_user")) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/session/enter";
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

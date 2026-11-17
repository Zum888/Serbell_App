import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.cookies.get("serbell_user")) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/session/enter";
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|demo|favicon.ico|.*\\..*).*)"],
};

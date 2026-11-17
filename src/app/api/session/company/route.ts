import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { originOf } from "@/server/http";
import { COMPANY_COOKIE, requireActor, setDemoCompany, USER_COOKIE } from "@/server/session";

export async function GET(request: Request) {
  try {
    const { actor, viewerSub } = await requireActor();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    await setDemoCompany(viewerSub, actor, companyId);
    const next = safeNext(url.searchParams.get("next"), "/movimientos");
    const response = NextResponse.redirect(new URL(next, `${originOf(request)}/`));
    response.headers.set("cache-control", "private, no-store");
    response.cookies.set(USER_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    response.cookies.set(COMPANY_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    return response;
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "cache-control": "private, no-store" } },
      );
    }
    throw error;
  }
}

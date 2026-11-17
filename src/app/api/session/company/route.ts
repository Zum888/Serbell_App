import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { assertCompanyAccess } from "@/lib/permissions";
import { safeNext } from "@/lib/utils";
import { COMPANY_COOKIE, cookieOptions, requireActor } from "@/server/session";

export async function GET(request: Request) {
  try {
    const { actor } = await requireActor();
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";
    assertCompanyAccess(actor, companyId);
    const next = safeNext(url.searchParams.get("next"), "/movimientos");
    const response = NextResponse.redirect(new URL(next, request.url));
    response.cookies.set(COMPANY_COOKIE, companyId, cookieOptions);
    return response;
  } catch (error) {
    if (isAppError(error)) return new NextResponse(error.message, { status: error.status });
    throw error;
  }
}

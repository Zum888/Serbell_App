import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { originOf } from "@/server/http";
import { COMPANY_COOKIE, requireActor, setDemoCompany, USER_COOKIE } from "@/server/session";

export function GET() {
  return NextResponse.json(
    { error: "Cambia de empresa con el formulario.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { "cache-control": "private, no-store", allow: "POST" } },
  );
}

export async function POST(request: Request) {
  try {
    const { actor, viewerSub } = await requireActor();
    const form = await request.formData();
    const companyId = String(form.get("companyId") ?? "");
    await setDemoCompany(viewerSub, actor, companyId);
    const next = safeNext(String(form.get("next") ?? ""), "/movimientos");
    const response = NextResponse.redirect(new URL(next, `${originOf(request)}/`), 303);
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

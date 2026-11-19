import { NextResponse } from "next/server";
import { PROFILES } from "@/lib/ids";
import { isAppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { originOf } from "@/server/http";
import { COMPANY_COOKIE, currentViewerSub, saveDemoBinding, USER_COOKIE } from "@/server/session";

export function GET() {
  return NextResponse.json(
    { error: "Cambia de perfil con el formulario.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { "cache-control": "private, no-store", allow: "POST" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const viewerSub = await currentViewerSub();
  const profile = PROFILES.find((item) => item.id === String(form.get("user") ?? "")) ?? PROFILES[0];
  try {
    await saveDemoBinding(viewerSub, profile.id);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "cache-control": "private, no-store" } },
      );
    }
    throw error;
  }
  const next = safeNext(String(form.get("next") ?? ""), profile.home);
  const response = NextResponse.redirect(new URL(next, `${originOf(request)}/`), 303);
  response.headers.set("cache-control", "private, no-store");
  response.cookies.set(USER_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
  response.cookies.set(COMPANY_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
  return response;
}

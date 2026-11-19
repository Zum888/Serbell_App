import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { grantCookie, passwordMatches } from "@/server/access";
import { originOf } from "@/server/http";
import { clearLoginFailures, globalLoginAllowed, loginAllowed, loginBucketKey, noteLoginFailure } from "@/server/login-limit";
import { safeNext } from "@/lib/utils";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""), "/");
  const origin = originOf(request);
  const address = loginBucketKey(request);

  if (!address || !globalLoginAllowed() || !loginAllowed(address)) {
    const back = new URL("/acceso", `${origin}/`);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "2");
    return NextResponse.redirect(back, { status: 303, headers: { "cache-control": "private, no-store" } });
  }

  if (!passwordMatches(password)) {
    noteLoginFailure(address);
    const back = new URL("/acceso", `${origin}/`);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, { status: 303, headers: { "cache-control": "private, no-store" } });
  }

  clearLoginFailures(address);
  const cookie = grantCookie((await cookies()).get("sb_access")?.value);
  const response = NextResponse.redirect(new URL(next, `${origin}/`), {
    status: 303,
    headers: { "cache-control": "private, no-store" },
  });
  if (cookie) {
    response.cookies.set(cookie.name, cookie.value, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(origin).protocol === "https:",
      maxAge: 60 * 60 * 12,
    });
  }
  return response;
}

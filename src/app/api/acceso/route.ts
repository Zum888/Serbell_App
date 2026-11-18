import { NextResponse } from "next/server";
import { grantCookie, passwordMatches } from "@/server/access";
import { originOf } from "@/server/http";
import { safeNext } from "@/lib/utils";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""), "/");
  const origin = originOf(request);

  if (!passwordMatches(password)) {
    const back = new URL("/acceso", `${origin}/`);
    back.searchParams.set("next", next);
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, { status: 303, headers: { "cache-control": "private, no-store" } });
  }

  const cookie = grantCookie();
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

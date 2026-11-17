import { NextResponse } from "next/server";
import { requireIdentity } from "../../../../../cursor/identity";
import { PROFILE_COMPANY, PROFILES } from "@/lib/ids";
import { safeNext } from "@/lib/utils";
import { originOf } from "@/server/http";
import { COMPANY_COOKIE, USER_COOKIE, cookieOptions } from "@/server/session";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const url = new URL(request.url);
  const profile = PROFILES.find((item) => item.id === url.searchParams.get("user")) ?? PROFILES[0];
  const next = safeNext(url.searchParams.get("next"), profile.home);
  const response = NextResponse.redirect(new URL(next, `${originOf(request)}/`));
  response.headers.set("cache-control", "private, no-store");
  response.cookies.set(USER_COOKIE, profile.id, cookieOptions);
  response.cookies.set(COMPANY_COOKIE, PROFILE_COMPANY[profile.id], cookieOptions);
  return response;
}

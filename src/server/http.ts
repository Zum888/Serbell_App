import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";

export function redirectTo(req: Request, path: string, error?: string) {
  const url = new URL(path, req.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export function redirectError(req: Request, path: string, error: unknown) {
  if (isAppError(error)) return redirectTo(req, path, error.message);
  throw error;
}

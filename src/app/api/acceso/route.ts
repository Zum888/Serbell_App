import { NextResponse } from "next/server";
import { originOf } from "@/server/http";

function home(request: Request) {
  const response = NextResponse.redirect(new URL("/", `${originOf(request)}/`), 303);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export function GET(request: Request) {
  return home(request);
}

export function POST(request: Request) {
  return home(request);
}

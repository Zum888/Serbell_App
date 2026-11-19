import { NextResponse } from "next/server";
import { originOf } from "@/server/http";

/** The lab only shows the built-in illustration. It does not read or download a stored file. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/demo/comprobante.svg", `${originOf(request)}/`), 307);
}

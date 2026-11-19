import { NextResponse } from "next/server";
import { originOf } from "@/server/http";

/** The lab only shows the built-in illustration. It does not read or download a stored file. */
export async function GET(request: Request) {
  const origin = originOf(request);
  return NextResponse.redirect(new URL("/demo/comprobante.svg", `${origin}/`), 307);
}

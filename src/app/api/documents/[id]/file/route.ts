import { NextResponse } from "next/server";
import { hasAccess } from "@/server/access";
import { originOf } from "@/server/http";

/** The lab only shows the built-in illustration. It does not read or download a stored file. */
export async function GET(request: Request) {
  const origin = originOf(request);
  if (!(await hasAccess())) {
    return NextResponse.redirect(new URL("/acceso?next=/", `${origin}/`), 307);
  }
  return NextResponse.redirect(new URL("/demo/comprobante.svg", `${origin}/`), 307);
}

import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { addCategory } from "@/server/domain";
import { redirectError, redirectTo, wantsJson } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  const json = wantsJson(request);
  let companyId = "";
  let parentId = "";
  let name = "";
  if (json) {
    const body = (await request.json()) as { companyId?: string; parentId?: string; name?: string };
    companyId = String(body.companyId ?? "");
    parentId = String(body.parentId ?? "");
    name = String(body.name ?? "");
  } else {
    const form = await request.formData();
    companyId = String(form.get("companyId") ?? "");
    parentId = String(form.get("parentId") ?? "");
    name = String(form.get("name") ?? "");
  }
  try {
    const { actor } = await requireActor();
    const created = await addCategory((await db()), actor, {
      companyId,
      parentId: parentId || null,
      name,
    });
    if (json) return NextResponse.json(created);
    return redirectTo(request, "/categorias");
  } catch (error) {
    if (json && isAppError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return redirectError(request, "/categorias", error);
  }
}

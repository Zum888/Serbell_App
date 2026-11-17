import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { addCategory } from "@/server/domain";
import { redirectError, redirectTo, wantsJson } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const parentId = String(form.get("parentId") ?? "");
  const json = wantsJson(request);
  try {
    const { actor } = await requireActor();
    const created = await addCategory(db(), actor, {
      companyId: String(form.get("companyId") ?? ""),
      parentId: parentId || null,
      name: String(form.get("name") ?? ""),
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

import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { addMovementComment } from "@/server/domain";
import { redirectError, redirectTo, wantsJson } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/movimientos?movimiento=${id}`);
  const json = wantsJson(request);
  try {
    const { actor } = await requireActor();
    const saved = await addMovementComment((await db()), actor, id, String(form.get("body") ?? ""));
    if (json) return NextResponse.json(saved);
    return redirectTo(request, back);
  } catch (error) {
    if (json && isAppError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return redirectError(request, back, error);
  }
}

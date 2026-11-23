import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { moveCategory, renameCategory } from "@/server/domain";
import { redirectError, redirectTo, wantsJson } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (wantsJson(request)) {
    try {
      const { actor } = await requireActor();
      const body = (await request.json()) as { name?: string; parentId?: string };
      if (typeof body.parentId === "string" && body.parentId) {
        await moveCategory((await db()), actor, id, body.parentId);
      }
      if (typeof body.name === "string") {
        await renameCategory((await db()), actor, id, body.name);
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      throw error;
    }
  }
  const form = await request.formData();
  try {
    const { actor } = await requireActor();
    await renameCategory((await db()), actor, id, String(form.get("name") ?? ""));
    return redirectTo(request, "/categorias");
  } catch (error) {
    return redirectError(request, "/categorias", error);
  }
}

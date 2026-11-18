import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { requestClarification } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/movimientos?movimiento=${id}`);
  try {
    const { actor } = await requireActor();
    await requestClarification((await db()), actor, id, String(form.get("message") ?? ""));
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { db } from "@/server/db";
import { reconcileTransaction } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { safeNext } from "@/lib/utils";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), "/movimientos");
  try {
    const { actor } = await requireActor();
    await reconcileTransaction(db(), actor, id);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

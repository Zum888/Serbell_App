import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { nextBankStep, setBankReconciliation } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), "/cuentas");
  try {
    const { actor } = await requireActor();
    const undo = String(form.get("action") ?? "") === "undo";
    await setBankReconciliation((await db()), actor, id, undo ? "Unreconciled" : "Reconciled");
    if (undo || String(form.get("stay") ?? "") === "1") return redirectTo(request, back);
    return redirectTo(request, await nextBankStep((await db()), actor, id));
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { changeClassification, confirmLink } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/chat?documento=${id}`);
  try {
    const { actor } = await requireActor();
    const database = await db();
    const transactionId = String(form.get("transactionId") ?? "");
    const subcategoryId = String(form.get("subcategoryId") ?? "");
    if (subcategoryId) {
      await changeClassification(database, actor, transactionId, {
        subcategoryId,
        justification: "Clasificación al vincular el comprobante.",
      });
    }
    await confirmLink(database, actor, id, transactionId);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

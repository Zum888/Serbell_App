import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { applyMerchantCategory, confirmFocus, nextFocusPath, skipFocus } from "@/server/focus";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/movimientos?vista=enfoque&actual=${id}`);
  try {
    const { actor } = await requireActor();
    const action = String(form.get("action") ?? "confirm");
    if (action === "skip") {
      await skipFocus(db(), actor, id);
    } else if (action === "apply") {
      await applyMerchantCategory(db(), actor, id, {
        subcategoryId: String(form.get("subcategoryId") ?? ""),
        justification: String(form.get("justification") ?? ""),
      });
    } else {
      const documentId = String(form.get("documentId") ?? "");
      await confirmFocus(db(), actor, id, {
        subcategoryId: String(form.get("subcategoryId") ?? ""),
        documentId: documentId || null,
        justification: String(form.get("justification") ?? ""),
      });
    }
    return redirectTo(request, await nextFocusPath(db(), actor, id));
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { db } from "@/server/db";
import { changeClassification } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const back = `/movimientos?movimiento=${id}`;
  const form = await request.formData();
  try {
    const { actor } = await requireActor();
    await changeClassification(db(), actor, id, {
      subcategoryId: String(form.get("subcategoryId") ?? ""),
      justification: String(form.get("justification") ?? ""),
    });
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { db } from "@/server/db";
import { sealTransaction } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const back = `/movimientos?movimiento=${id}`;
  try {
    const { actor } = await requireActor();
    await sealTransaction(db(), actor, id);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { db } from "@/server/db";
import { renameCategory } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  try {
    const { actor } = await requireActor();
    await renameCategory(db(), actor, id, String(form.get("name") ?? ""));
    return redirectTo(request, "/categorias");
  } catch (error) {
    return redirectError(request, "/categorias", error);
  }
}

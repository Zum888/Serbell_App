import { db } from "@/server/db";
import { addCategory } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const parentId = String(form.get("parentId") ?? "");
  try {
    const { actor } = await requireActor();
    await addCategory(db(), actor, {
      companyId: String(form.get("companyId") ?? ""),
      parentId: parentId || null,
      name: String(form.get("name") ?? ""),
    });
    return redirectTo(request, "/categorias");
  } catch (error) {
    return redirectError(request, "/categorias", error);
  }
}

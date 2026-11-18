import { db } from "@/server/db";
import { postChat } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const companyId = String(form.get("companyId") ?? "");
  const text = String(form.get("text") ?? "");
  const back = "/chat";
  try {
    const { actor } = await requireActor();
    await postChat((await db()), actor, companyId, text);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { redirectError, redirectTo } from "@/server/http";
import { advanceInvoiceApproval } from "@/server/invoices";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), "/por-cobrar");
  try {
    const { actor } = await requireActor();
    await advanceInvoiceApproval(db(), actor, id);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

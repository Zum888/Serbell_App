import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { markInvoiceFollowUp } from "@/server/invoices";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/por-cobrar?factura=${id}`);
  try {
    const { actor } = await requireActor();
    await markInvoiceFollowUp(db(), actor, id);
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

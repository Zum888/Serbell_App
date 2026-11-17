import { parseMoneyToCents } from "@/lib/money";
import { db } from "@/server/db";
import { updateExtraction } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const back = `/chat?documento=${id}`;
  const form = await request.formData();
  try {
    const { actor } = await requireActor();
    const amountCents = parseMoneyToCents(String(form.get("amount") ?? ""));
    if (amountCents === null) return redirectTo(request, back, "El importe no es válido.");
    await updateExtraction(db(), actor, id, {
      merchant: String(form.get("merchant") ?? ""),
      amountCents,
      occurredOn: String(form.get("occurredOn") ?? "") || null,
    });
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

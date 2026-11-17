import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { saveJournalEntry } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

function cents(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/movimientos?movimiento=${id}`);
  const names = form.getAll("accountName").map(String);
  const debits = form.getAll("debitCents").map(String);
  const credits = form.getAll("creditCents").map(String);
  try {
    const { actor } = await requireActor();
    await saveJournalEntry(db(), actor, id, {
      subcategoryId: String(form.get("subcategoryId") ?? ""),
      justification: String(form.get("justification") ?? ""),
      lines: names.map((accountName, index) => ({
        accountName,
        debitCents: cents(debits[index] ?? ""),
        creditCents: cents(credits[index] ?? ""),
      })),
    });
    return redirectTo(request, back);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

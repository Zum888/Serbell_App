import { parseMoneyToCents } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { db } from "@/server/db";
import { createManualAccount } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const back = "/cuentas";
  try {
    const { actor, companyId } = await requireActor();
    if (!companyId) throw new AppError("Selecciona una empresa.", 400, "COMPANY_REQUIRED");
    const cents = parseMoneyToCents(String(form.get("balance") ?? ""));
    if (cents === null) throw new AppError("El saldo inicial tiene que ser un importe en USD.", 400, "AMOUNT_INVALID");
    const id = await createManualAccount(db(), actor, companyId, {
      institution: String(form.get("institution") ?? ""),
      name: String(form.get("name") ?? ""),
      mask: String(form.get("mask") ?? ""),
      kind: String(form.get("kind") ?? ""),
      openingBalanceCents: cents,
    });
    return redirectTo(request, `/cuentas?cuenta=${id}`);
  } catch (error) {
    return redirectError(request, back, error);
  }
}

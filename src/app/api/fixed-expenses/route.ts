import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { db } from "@/server/db";
import { createFixedExpense } from "@/server/planning";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  try {
    const { actor, companyId } = await requireActor();
    if (!companyId) throw new AppError("Selecciona una empresa.", 400, "COMPANY_REQUIRED");
    const body = (await request.json()) as Record<string, unknown>;
    const cents = parseMoneyToCents(String(body.amount ?? ""));
    if (cents === null) throw new AppError("El monto tiene que ser un importe en USD.", 400, "AMOUNT_INVALID");
    const id = await createFixedExpense((await db()), actor, companyId, {
      name: String(body.name ?? ""),
      vendor: String(body.vendor ?? ""),
      amountCents: cents,
      dueDay: Number(body.dueDay),
      accountId: String(body.accountId ?? ""),
      subcategoryId: String(body.subcategoryId ?? ""),
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

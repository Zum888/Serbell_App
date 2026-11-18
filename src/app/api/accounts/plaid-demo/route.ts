import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { createManualAccount } from "@/server/domain";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  try {
    const { actor, companyId } = await requireActor();
    if (!companyId) throw new AppError("Selecciona una empresa.", 400, "COMPANY_REQUIRED");
    const body = (await request.json()) as Record<string, unknown>;
    const id = await createManualAccount((await db()), actor, companyId, {
      institution: String(body.institution ?? ""),
      name: String(body.name ?? ""),
      mask: String(body.mask ?? ""),
      kind: String(body.kind ?? ""),
      openingBalanceCents: Number(body.balanceCents),
      origin: "plaid_demo",
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

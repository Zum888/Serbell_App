import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { COMPANY } from "@/lib/ids";
import { db } from "@/server/db";
import { prepareFleetSmartsMatch } from "@/server/domain";
import { requireActor } from "@/server/session";

export async function POST() {
  try {
    const { actor, companyId } = await requireActor();
    if (companyId !== COMPANY.qpl) {
      return NextResponse.json({ error: "Ese ticket es de Quick Pick Logistics." }, { status: 400 });
    }
    const result = await prepareFleetSmartsMatch(await db(), actor);
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

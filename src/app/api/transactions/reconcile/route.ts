import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { reconcileTransactions } from "@/server/domain";
import { requireActor } from "@/server/session";

export async function POST(request: Request) {
  try {
    const { actor } = await requireActor();
    const body = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    const reconciled = await reconcileTransactions(db(), actor, ids);
    return NextResponse.json({ reconciled });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { operationSnapshot } from "@/server/domain";
import { requireActor } from "@/server/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { actor } = await requireActor();
    const company = await operationSnapshot(db(), actor, id);
    return NextResponse.json(company);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}

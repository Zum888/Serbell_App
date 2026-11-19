import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { attachMissingReceipts } from "@/server/domain";
import { requireActor } from "@/server/session";

export async function POST() {
  try {
    const { actor } = await requireActor();
    const result = await attachMissingReceipts((await db()), actor);
    return NextResponse.json(result);
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

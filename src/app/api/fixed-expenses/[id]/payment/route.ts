import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { setFixedPaid } from "@/server/planning";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { actor } = await requireActor();
    const body = (await request.json()) as { paid?: unknown };
    await setFixedPaid((await db()), actor, id, body.paid === true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

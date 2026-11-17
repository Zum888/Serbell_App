import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { readDocumentFile } from "@/server/queries";
import { requireActor } from "@/server/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { actor } = await requireActor();
    const document = await readDocumentFile(db(), actor, id);
    const bytes = await readFile(path.join(process.cwd(), document.storagePath));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": document.mimeType,
        "content-disposition": `inline; filename="${document.fileName}"`,
      },
    });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

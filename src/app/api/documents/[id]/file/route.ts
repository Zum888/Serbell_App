import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { storageFile } from "@/server/paths";
import { readDocumentFile } from "@/server/queries";
import { requireActor } from "@/server/session";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { actor } = await requireActor();
    const document = await readDocumentFile((await db()), actor, id);
    const bytes = await readFile(/*turbopackIgnore: true*/ storageFile(document.storagePath));
    const download = new URL(request.url).searchParams.get("descarga") === "1";
    const fileName = document.fileName.replace(/"/g, "");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": document.mimeType,
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}

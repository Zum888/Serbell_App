import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { saveUploadedDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export function GET() {
  return NextResponse.json(
    { error: "Usa el botón para cargar el comprobante de demostración.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { allow: "POST" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const companyId = String(form.get("companyId") ?? "");
  try {
    const { actor } = await requireActor();
    const bytes = await readFile(path.join(process.cwd(), "fixtures", "FleetSmarts_ticket.jpg"));
    const saved = await saveUploadedDocument(db(), actor, {
      companyId,
      fileName: "FleetSmarts_ticket.jpg",
      mimeType: "image/jpeg",
      bytes,
    });
    return redirectTo(request, `/chat?documento=${saved.id}`);
  } catch (error) {
    return redirectError(request, "/chat", error);
  }
}

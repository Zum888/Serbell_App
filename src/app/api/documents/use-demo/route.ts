import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import { saveUploadedDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? "";
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

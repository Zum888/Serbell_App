import { db } from "@/server/db";
import { saveUploadedDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

function mimeOf(file: File): string {
  if (file.type === "image/jpg") return "image/jpeg";
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const companyId = String(form.get("companyId") ?? "");
  try {
    const { actor } = await requireActor();
    if (!(file instanceof File)) {
      return redirectTo(request, "/chat", "Selecciona un archivo.");
    }
    const saved = await saveUploadedDocument(db(), actor, {
      companyId,
      fileName: file.name,
      mimeType: mimeOf(file),
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return redirectTo(request, `/chat?documento=${saved.id}`);
  } catch (error) {
    return redirectError(request, "/chat", error);
  }
}

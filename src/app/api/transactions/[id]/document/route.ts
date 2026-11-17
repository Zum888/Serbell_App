import { AppError } from "@/lib/errors";
import { db } from "@/server/db";
import { replaceTransactionDocument, uploadReplacementDocument } from "@/server/domain";
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

function movementPath(id: string, form: FormData, documentId?: string) {
  const params = new URLSearchParams();
  const filtro = String(form.get("filtro") ?? "");
  const q = String(form.get("q") ?? "");
  if (filtro) params.set("filtro", filtro);
  if (q) params.set("q", q);
  params.set("fila", id);
  const recibo = documentId || String(form.get("recibo") ?? "");
  if (recibo) params.set("recibo", recibo);
  return `/movimientos?${params}`;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = movementPath(id, form);
  try {
    const { actor } = await requireActor();
    const file = form.get("file");
    let documentId = String(form.get("documentId") ?? "");
    if (file instanceof File && file.size > 0) {
      documentId = await uploadReplacementDocument(db(), actor, id, {
        fileName: file.name || "comprobante",
        mimeType: mimeOf(file),
        bytes: Buffer.from(await file.arrayBuffer()),
      });
    } else if (!documentId) {
      throw new AppError("Elige un comprobante guardado o sube un archivo.", 400, "DOCUMENT_REQUIRED");
    } else {
      await replaceTransactionDocument(db(), actor, id, documentId);
    }
    return redirectTo(request, movementPath(id, form, documentId));
  } catch (error) {
    return redirectError(request, back, error);
  }
}

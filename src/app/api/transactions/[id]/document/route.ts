import { AppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { replaceTransactionDocument, uploadReplacementDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor, requireViewer } from "@/server/session";
import { readCappedForm, readUploadFile } from "@/server/upload";

function movementPath(id: string, form: FormData, documentId?: string) {
  const requested = safeNext(String(form.get("next") ?? ""), "");
  if (requested) {
    const url = new URL(requested, "http://local");
    if (documentId) url.searchParams.set("recibo", documentId);
    url.searchParams.set("fila", id);
    return `${url.pathname}${url.search}`;
  }
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
  let back = `/movimientos?fila=${id}`;
  try {
    await requireViewer();
    const form = await readCappedForm(request);
    back = movementPath(id, form);
    const { actor } = await requireActor();
    const file = form.get("file");
    let documentId = String(form.get("documentId") ?? "");
    if (file instanceof File && file.size > 0) {
      const upload = await readUploadFile(file);
      documentId = await uploadReplacementDocument(db(), actor, id, {
        fileName: file.name || "comprobante",
        mimeType: upload.mimeType,
        bytes: upload.bytes,
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

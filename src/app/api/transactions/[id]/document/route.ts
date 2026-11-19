import { AppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { replaceTransactionDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor, requireViewer } from "@/server/session";

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
    const form = await request.formData();
    back = movementPath(id, form);
    const { actor } = await requireActor();
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      throw new AppError("Este laboratorio no recibe archivos. Elige un comprobante de demostración.", 400, "SIMULATED");
    }
    const documentId = String(form.get("documentId") ?? "");
    if (!documentId) {
      throw new AppError("Elige un comprobante de demostración.", 400, "DOCUMENT_REQUIRED");
    }
    await replaceTransactionDocument((await db()), actor, id, documentId);
    return redirectTo(request, movementPath(id, form, documentId));
  } catch (error) {
    return redirectError(request, back, error);
  }
}

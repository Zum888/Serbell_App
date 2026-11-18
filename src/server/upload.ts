import { AppError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 8_000_000;
export const MAX_UPLOADS_PER_COMPANY = 40;
const FORM_OVERHEAD = 256_000;

export const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}

export function uploadMime(file: File): string {
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const fromName = mimeFromName(file.name);
  if (declared && !ALLOWED_UPLOAD_TYPES.has(declared)) {
    throw new AppError("Solo se aceptan JPG, PNG, WEBP o PDF.", 400, "FILE_TYPE");
  }
  if (declared && fromName && declared !== fromName) {
    throw new AppError("Solo se aceptan JPG, PNG, WEBP o PDF.", 400, "FILE_TYPE");
  }
  const mime = declared || fromName;
  if (!mime || !ALLOWED_UPLOAD_TYPES.has(mime)) {
    throw new AppError("Solo se aceptan JPG, PNG, WEBP o PDF.", 400, "FILE_TYPE");
  }
  return mime;
}

export async function readUploadFile(file: File): Promise<{ mimeType: string; bytes: Buffer }> {
  if (file.size <= 0) throw new AppError("El archivo está vacío.", 400, "EMPTY_FILE");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("El archivo supera 8 MB.", 400, "FILE_TOO_LARGE");
  const mimeType = uploadMime(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new AppError("El archivo supera 8 MB.", 400, "FILE_TOO_LARGE");
  return { mimeType, bytes };
}

/** Stops reading once the request is larger than the upload cap. */
export async function readCappedForm(request: Request): Promise<FormData> {
  const limit = MAX_UPLOAD_BYTES + FORM_OVERHEAD;
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0 || length > limit) {
      throw new AppError("El archivo supera 8 MB.", 400, "FILE_TOO_LARGE");
    }
  }
  if (!request.body) return request.formData();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AppError("El archivo supera 8 MB.", 400, "FILE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, { method: request.method, headers, body }).formData();
}

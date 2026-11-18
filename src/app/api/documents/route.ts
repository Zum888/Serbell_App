import { db } from "@/server/db";
import { saveUploadedDocument } from "@/server/domain";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor, requireViewer } from "@/server/session";
import { readCappedForm, readUploadFile } from "@/server/upload";

export async function POST(request: Request) {
  try {
    await requireViewer();
    const form = await readCappedForm(request);
    const file = form.get("file");
    const companyId = String(form.get("companyId") ?? "");
    const { actor } = await requireActor();
    if (!(file instanceof File)) {
      return redirectTo(request, "/chat", "Selecciona un archivo.");
    }
    const upload = await readUploadFile(file);
    const saved = await saveUploadedDocument((await db()), actor, {
      companyId,
      fileName: file.name,
      mimeType: upload.mimeType,
      bytes: upload.bytes,
    });
    return redirectTo(request, `/chat?documento=${saved.id}`);
  } catch (error) {
    return redirectError(request, "/chat", error);
  }
}

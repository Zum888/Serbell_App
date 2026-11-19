import { redirectError, redirectTo } from "@/server/http";
import { requireViewer } from "@/server/session";

export async function POST(request: Request) {
  try {
    await requireViewer();
  } catch (error) {
    return redirectError(request, "/chat", error);
  }
  return redirectTo(
    request,
    "/chat",
    "Este laboratorio no recibe archivos. Los comprobantes que ves son de demostración.",
  );
}

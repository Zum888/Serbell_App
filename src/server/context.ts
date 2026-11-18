import { pageSession } from "@/server/session";
import { AppError } from "@/lib/errors";

export async function pageContext() {
  const session = await pageSession();
  if (!session) throw new AppError("No hay una sesión de laboratorio.", 401, "NO_SESSION");
  return session;
}

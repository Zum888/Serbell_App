import { redirect } from "next/navigation";
import { hasAccess } from "@/server/access";
import { pageSession } from "@/server/session";

export async function pageContext() {
  if (!(await hasAccess())) redirect("/acceso?next=/");
  const session = await pageSession();
  if (!session?.actor) redirect("/acceso?next=/");
  return session;
}

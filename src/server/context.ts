import { redirect } from "next/navigation";
import { pageSession } from "@/server/session";

export async function pageContext() {
  const session = await pageSession();
  if (!session) redirect("/api/session/enter?next=/");
  return session;
}

import { redirect } from "next/navigation";
import { pageSession } from "@/server/session";

export async function pageContext() {
  const session = await pageSession();
  if (!session?.actor) redirect("/");
  return session;
}

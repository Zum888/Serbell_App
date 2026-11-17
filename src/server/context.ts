import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getShell, loadActor } from "@/server/queries";
import { COMPANY_COOKIE, requirePageViewer, USER_COOKIE } from "@/server/session";

export async function pageContext() {
  await requirePageViewer();
  const jar = await cookies();
  const userId = jar.get(USER_COOKIE)?.value;
  if (!userId) redirect("/api/session/enter?next=/");
  const actor = await loadActor(db(), userId);
  if (!actor) redirect("/api/session/enter?next=/");
  const requested = jar.get(COMPANY_COOKIE)?.value ?? null;
  const companyId = requested && actor.memberships.some((membership) => membership.companyId === requested) ? requested : null;
  const shell = await getShell(db(), actor);
  return { actor, companyId, companies: shell.companies };
}

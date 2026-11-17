import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { StateView } from "@/components/state-view";
import { db } from "@/server/db";
import { getShell, loadActor } from "@/server/queries";
import { COMPANY_COOKIE, requirePageViewer, USER_COOKIE } from "@/server/session";

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  await requirePageViewer();
  const jar = await cookies();
  const userId = jar.get(USER_COOKIE)?.value;
  if (!userId) redirect("/api/session/enter?next=/");
  let actor = null;
  try {
    actor = await loadActor(db(), userId);
  } catch {
    actor = null;
  }
  if (!actor) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <StateView
          variant="error"
          title="La base del laboratorio no está lista."
          description="Ejecuta npm run db:reset y vuelve a abrir la aplicación."
        />
      </main>
    );
  }
  const requested = jar.get(COMPANY_COOKIE)?.value ?? null;
  const companyId = requested && actor.memberships.some((membership) => membership.companyId === requested) ? requested : null;
  const shell = await getShell(db(), actor);
  return (
    <Shell actor={actor} companies={shell.companies} companyId={companyId}>
      {children}
    </Shell>
  );
}

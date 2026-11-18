import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { StateView } from "@/components/state-view";
import { hasAccess } from "@/server/access";
import { pageSession } from "@/server/session";

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAccess())) redirect("/acceso?next=/");
  const session = await pageSession();
  if (!session) redirect("/api/session/enter?next=/");
  if (!session.actor) {
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
  return (
    <Shell actor={session.actor} companies={session.companies} companyId={session.companyId}>
      {children}
    </Shell>
  );
}

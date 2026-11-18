import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { StateView } from "@/components/state-view";
import { hasAccess } from "@/server/access";
import { pageSession } from "@/server/session";

function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAccess())) redirect("/acceso?next=/");
  let session;
  try {
    session = await pageSession();
  } catch (error) {
    if (isRedirect(error)) throw error;
    return (
      <main className="mx-auto max-w-lg p-8">
        <StateView
          variant="error"
          title="No se pudo abrir el laboratorio."
          description="Vuelve a cargar la página. Si sigue igual, el servidor no alcanzó a preparar la base de demostración."
        />
      </main>
    );
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <StateView variant="error" title="No hay una sesión de laboratorio." />
      </main>
    );
  }
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
    <Shell actor={session.actor} companies={session.companies} companyId={session.companyId} canSwitchProfiles={session.canSwitchProfiles}>
      {children}
    </Shell>
  );
}

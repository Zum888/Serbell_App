import Link from "next/link";
import { StateView } from "@/components/state-view";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { companyProfile } from "@/server/queries";

const ROLE: Record<string, string> = {
  BUSINESS_OWNER: "Propietario",
  ACCOUNTANT: "Contador",
  FIRM_ADMIN: "Administración de la firma",
};

export default async function SettingsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa." />;
  const profile = await companyProfile((await db()), session.actor, session.companyId);
  return (
    <section className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Datos guardados de esta empresa. No hay otras preferencias: cambiarlas aquí no haría nada, así que no se ofrece ese formulario.
        </p>
      </div>
      <article className="rounded-2xl border border-border bg-white p-4 text-sm">
        <p className="text-slate-500">Empresa</p>
        <p className="text-lg font-semibold">{profile.name}</p>
        <p className="text-slate-600">{profile.industry}</p>
      </article>
      <article className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Personas con acceso</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {profile.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-2">
              <span>
                <span className="block font-medium">{member.name}</span>
                <span className="text-xs text-slate-500">{member.email}</span>
              </span>
              <span className="text-slate-600">{ROLE[member.role] ?? member.role}</span>
            </li>
          ))}
        </ul>
      </article>
      <p className="text-sm">
        El catálogo sí se puede editar. <Link href="/categorias" className="font-medium text-primary">Ir a categorías</Link>
      </p>
    </section>
  );
}

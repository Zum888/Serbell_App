import Link from "next/link";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { firmQueue } from "@/server/queries";

const TITLES: Record<string, string> = {
  revisar: "Movimientos por revisar",
  comprobantes: "Comprobantes faltantes",
  aclaraciones: "Aclaraciones abiertas",
  aprobar: "Listos para aprobar",
  duplicados: "Comprobantes duplicados",
  empresas: "Empresas asignadas",
};

export default async function FirmListPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await pageContext();
  const params = await searchParams;
  const tipo = params.tipo && TITLES[params.tipo] ? params.tipo : "revisar";
  try {
    const rows = await firmQueue(db(), session.actor, tipo);
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Despacho</p>
            <h1 className="text-2xl font-semibold tracking-tight">{TITLES[tipo]}</h1>
          </div>
          <Link href="/firma" className="text-sm font-medium text-primary">Volver al inicio</Link>
        </div>
        {rows.length === 0 ? (
          <StateView variant="empty" title="No hay elementos en esta lista." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Elemento</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-testid="firm-queue-row" className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{row.companyName}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-slate-500">{row.detail}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a className="font-medium text-primary" href={row.href}>Abrir</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">{rows.length} en esta lista. El conteo sale de las empresas asignadas.</p>
      </section>
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

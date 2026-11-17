import Link from "next/link";
import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { bankSummary, expenseAnalysis } from "@/server/queries";

export default async function ReportsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver el reporte." />;
  const [summary, expenses] = await Promise.all([
    bankSummary(db(), session.actor, session.companyId),
    expenseAnalysis(db(), session.actor, session.companyId),
  ]);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reporte de movimientos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sumas de los movimientos bancarios guardados. No es un estado de resultados, no cierra el mes y no concilia el extracto.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="mt-1 text-2xl font-semibold">{formatUsd(summary.inflows)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Gastos</p>
          <p className="mt-1 text-2xl font-semibold">{formatUsd(Math.abs(summary.outflows))}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">Neto de movimientos</p>
          <p className="mt-1 text-2xl font-semibold">{formatUsd(summary.net)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.count} movimientos.</p>
        </article>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Subcategoría</th>
              <th className="px-4 py-3 text-right font-medium">Gastos</th>
            </tr>
          </thead>
          <tbody>
            {expenses.grouped.map((group) => (
              <tr key={`${group.category}/${group.subcategory}`} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{group.category}</td>
                <td className="px-4 py-3">{group.subcategory}</td>
                <td className="px-4 py-3 text-right">{formatUsd(group.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex gap-4 text-sm">
        <Link href="/gastos" className="font-medium text-primary">Análisis de gastos</Link>
        <Link href="/por-cobrar" className="font-medium text-primary">Cobros</Link>
      </p>
    </section>
  );
}

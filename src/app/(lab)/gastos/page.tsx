import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Bars, Sparkline } from "@/components/charts";
import { InsightStrip } from "@/components/insight-strip";
import { StateView } from "@/components/state-view";
import { expenseReading } from "@/lib/reading";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { companyReport, expenseAnalysis } from "@/server/queries";

export default async function ExpensesPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para analizar sus gastos." />;
  const [analysis, report] = await Promise.all([
    expenseAnalysis(db(), session.actor, session.companyId),
    companyReport(db(), session.actor, session.companyId),
  ]);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Análisis de gastos</h1>
        <p className="mt-1 text-sm text-slate-500">Suma de los movimientos negativos guardados. No es un estado de resultados.</p>
      </div>
      <InsightStrip lines={expenseReading({ ...report, accountCount: report.accounts.length })} testId="gastos-reading" />
      {analysis.rows.length === 0 ? (
        <StateView variant="empty" title="No hay gastos en los movimientos de esta empresa." />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
            <article className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <ArrowUpRight className="size-4" /> Total de gastos
              </div>
              <p data-testid="gastos-total" className="mt-2 text-3xl font-semibold tracking-tight">
                {formatUsd(analysis.totalCents)}
              </p>
              <Sparkline points={report.daily.map((point) => point.outflows)} color="#2563eb" />
              <p className="text-xs text-slate-500">{analysis.rows.length} movimientos de salida. La línea es el gasto de cada día.</p>
            </article>
            <article className="rounded-2xl border border-border bg-white p-4">
              <h2 className="text-sm font-semibold">Por categoría</h2>
              <div className="mt-3">
                <Bars rows={report.categories.map((row) => ({ label: row.category, value: row.totalCents, hint: formatUsd(row.totalCents) }))} />
              </div>
            </article>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Subcategoría</th>
                  <th className="px-4 py-3 font-medium">Movimientos</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {analysis.grouped.map((group) => (
                  <tr key={`${group.category}/${group.subcategory}`} data-testid="gastos-group" className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{group.category}</td>
                    <td className="px-4 py-3">{group.subcategory}</td>
                    <td className="px-4 py-3">{group.count}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(group.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Movimiento</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Subcategoría</th>
                  <th className="px-4 py-3 text-right font-medium">Gasto</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{row.postedOn}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.merchant}</p>
                      <p className="text-xs text-slate-500">{row.description}</p>
                    </td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3">{row.subcategory}</td>
                    <td className="px-4 py-3 text-right">{formatUsd(Math.abs(row.amountCents))}</td>
                    <td className="px-4 py-3">
                      <Link href={`/movimientos?movimiento=${row.id}`} className="text-sm font-medium text-primary">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

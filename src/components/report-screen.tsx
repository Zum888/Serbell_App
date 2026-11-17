import Link from "next/link";
import { Bars } from "@/components/charts";
import { formatUsd } from "@/lib/money";
import type { companyReport } from "@/server/queries";

type Report = Awaited<ReturnType<typeof companyReport>>;

export function ReportScreen({ companyName, report }: { companyName: string; report: Report }) {
  const period = report.firstDay ? `${report.firstDay} a ${report.lastDay}` : "Sin periodo";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-400">{companyName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm text-slate-500">{report.count} movimientos · {period}</p>
      </header>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <Figure label="Entradas" value={formatUsd(report.inflows)} tone="text-emerald-600" />
        <Figure label="Salidas" value={formatUsd(report.outflows)} tone="text-rose-600" />
        <Figure label="Neto" value={formatUsd(report.net)} tone={report.net < 0 ? "text-rose-600" : "text-slate-900"} testId="report-net" />
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold">Gastos por categoría</h2>
        {report.categories.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No hay gastos en los movimientos guardados.</p>
        ) : (
          <div className="mt-4">
            <Bars rows={report.categories.map((row) => ({ label: row.category, value: row.totalCents, hint: formatUsd(row.totalCents) }))} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold">Gastos mayores</h2>
        <ul className="mt-3 divide-y divide-border">
          {report.largestExpenses.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.merchant}</p>
                <p className="text-xs text-slate-500">{row.postedOn} · {row.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{formatUsd(row.amountCents)}</span>
                <Link href={`/movimientos?movimiento=${row.id}`} className="text-xs font-medium text-primary">Ver</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-2xl border border-border bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Detalle por subcategoría y cuentas</summary>
        <div className="space-y-5 border-t border-border px-5 py-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 font-medium">Subcategoría</th>
                  <th className="px-4 py-2 font-medium">Mov.</th>
                  <th className="px-4 py-2 text-right font-medium">Gastos</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.map((group) => (
                  <tr key={`${group.category}/${group.subcategory}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{group.category}</td>
                    <td className="px-4 py-2">{group.subcategory}</td>
                    <td className="px-4 py-2">{group.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatUsd(group.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.accounts.map((account) => (
              <article key={account.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{account.institution} ····{account.mask}</p>
                  {account.isDemonstration ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Demo</span> : null}
                </div>
                <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{formatUsd(account.availableBalanceCents)}</p>
                <p className="text-xs text-slate-500">Neto de movimientos {formatUsd(account.net)}.</p>
              </article>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function Figure({ label, value, tone, testId }: { label: string; value: string; tone: string; testId?: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p data-testid={testId} className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

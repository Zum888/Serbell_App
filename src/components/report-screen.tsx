import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import Link from "next/link";
import { Bars, Sparkline } from "@/components/charts";
import { InsightStrip } from "@/components/insight-strip";
import { reportReading } from "@/lib/reading";
import { formatUsd } from "@/lib/money";
import type { companyReport } from "@/server/queries";

type Report = Awaited<ReturnType<typeof companyReport>>;

export function ReportScreen({ companyName, report }: { companyName: string; report: Report }) {
  const lines = reportReading({ ...report, accountCount: report.accounts.length });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{companyName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        </div>
        <p className="text-sm text-slate-500">
          {report.count} movimientos{report.firstDay ? ` · ${report.firstDay} a ${report.lastDay}` : ""}
        </p>
      </div>
      <InsightStrip lines={lines} />
      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Entradas" value={formatUsd(report.inflows)} points={report.daily.map((point) => point.inflows)} detail="Suma de movimientos positivos." icon={<ArrowDownLeft className="size-4" />} />
        <Metric label="Salidas" value={formatUsd(report.outflows)} points={report.daily.map((point) => point.outflows)} detail="Suma de movimientos negativos." icon={<ArrowUpRight className="size-4" />} />
        <Metric label="Neto" value={formatUsd(report.net)} points={report.daily.map((point) => point.net)} detail="Entradas menos salidas. No es el saldo del banco." icon={<Scale className="size-4" />} testId="report-net" />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm font-semibold">Entradas y salidas</h2>
          <div className="mt-3">
            <Bars
              rows={[
                { label: "Entradas", value: report.inflows, hint: formatUsd(report.inflows) },
                { label: "Salidas", value: report.outflows, hint: formatUsd(report.outflows) },
              ]}
            />
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm font-semibold">Gastos por categoría</h2>
          <div className="mt-3">
            <Bars rows={report.categories.map((row) => ({ label: row.category, value: row.totalCents, hint: formatUsd(row.totalCents) }))} />
          </div>
        </article>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {report.accounts.map((account) => (
          <article key={account.id} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">{account.institution}</p>
              {account.isDemonstration ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Demostración</span> : null}
            </div>
            <p className="mt-1 text-sm font-medium">{account.productName}</p>
            <p className="text-xs text-slate-500">{account.kind === "card" ? "Tarjeta" : "Banco"} ····{account.mask}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight">{formatUsd(account.availableBalanceCents)}</p>
            <Sparkline points={account.series} color="#2563eb" />
            <p className="text-xs text-slate-500">Saldo guardado. Neto de movimientos {formatUsd(account.net)}.</p>
          </article>
        ))}
      </section>
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Subcategoría</th>
                <th className="px-4 py-3 font-medium">Movimientos</th>
                <th className="px-4 py-3 text-right font-medium">Gastos</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((group) => (
                <tr key={`${group.category}/${group.subcategory}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{group.category}</td>
                  <td className="px-4 py-3">{group.subcategory}</td>
                  <td className="px-4 py-3">{group.count}</td>
                  <td className="px-4 py-3 text-right">{formatUsd(group.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <article className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm font-semibold">Gastos mayores</h2>
          <ul className="mt-3 space-y-3">
            {report.largestExpenses.map((row) => (
              <li key={row.id} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">
                      {row.postedOn} · {row.category}
                      {row.isDemonstration ? " · Demostración" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">{formatUsd(row.amountCents)}</p>
                </div>
                <Link href={`/movimientos?movimiento=${row.id}`} className="text-xs font-medium text-primary">Ver movimiento</Link>
              </li>
            ))}
          </ul>
          {report.duplicates.length > 0 ? (
            <div className="mt-4 border-t border-border pt-3 text-sm">
              <p className="font-medium">Duplicados</p>
              {report.duplicates.map((row) => (
                <p key={row.id} className="mt-1 text-xs text-slate-500">
                  {row.fileName}{row.originalName ? ` es copia de ${row.originalName}` : ""}
                  {row.merchant ? ` · ${row.merchant}` : ""}
                  {row.amountCents !== null ? ` · ${formatUsd(row.amountCents)}` : ""}
                </p>
              ))}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  points,
  detail,
  icon,
  testId,
}: {
  label: string;
  value: string;
  points: number[];
  detail: string;
  icon: ReactNode;
  testId?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">{icon}{label}</div>
      <p data-testid={testId} className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <Sparkline points={points} color="#2563eb" />
      <p className="text-xs text-slate-500">{detail}</p>
    </article>
  );
}

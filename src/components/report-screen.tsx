"use client";

import { BarChart3, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDay } from "@/lib/dates";
import { monthName, shortMonth } from "@/lib/fixed";
import { cashDays, change, headline, percentLabel, subline, waterfall, weekly, type MonthTotals } from "@/lib/insights";
import { formatUsd } from "@/lib/money";
import type { companyReport } from "@/server/queries";
import type { monthHistory } from "@/server/planning";

type Report = Awaited<ReturnType<typeof companyReport>>;
type History = Awaited<ReturnType<typeof monthHistory>>;
type Desk = { totalCents: number; openCents: number; matchedCents: number; invoiceCount: number };
type Tab = "pyg" | "balance" | "flujo" | "cobrar" | "pagar" | "impuestos";

const TABS: { id: Tab; label: string }[] = [
  { id: "pyg", label: "Pérdidas y Ganancias" },
  { id: "balance", label: "Balance General" },
  { id: "flujo", label: "Flujo de Efectivo" },
  { id: "cobrar", label: "Cuentas por Cobrar" },
  { id: "pagar", label: "Cuentas por Pagar" },
  { id: "impuestos", label: "Impuestos" },
];

const SLICE_COLORS = ["#8eafc8", "#a9c4da", "#c5d7e6", "#d7e5f0", "#e8f1f6"];

function compact(cents: number): string {
  const value = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (value >= 1_000_000) return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${sign}$${(value / 1_000).toFixed(1)}k`;
  return `${sign}$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function tick(period: string) {
  const label = shortMonth(period);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function tone(kind: "income" | "expense" | "net", delta: number | null) {
  if (delta === null || Math.round(delta * 100) === 0) return "text-slate-400";
  const up = delta > 0;
  if (kind === "expense") return up ? "text-rose-600" : "text-emerald-600";
  return up ? "text-emerald-600" : "text-rose-600";
}

export function ReportScreen({
  companyName,
  report,
  history,
  fixed,
  receivable,
  payable,
}: {
  companyName: string;
  report: Report;
  history: History;
  fixed: { pendingCents: number; overdueCents: number; overdueCount: number };
  receivable: Desk;
  payable: Desk;
}) {
  const [tab, setTab] = useState<Tab>("pyg");
  const [detail, setDetail] = useState(false);
  const monthKey = (report.lastDay ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
  const current: MonthTotals = { month: monthKey, inflows: report.inflows, outflows: report.outflows, net: report.net };
  const previous = history.filter((row) => row.month < monthKey).at(-1) ?? null;
  const margin = report.inflows > 0 ? report.net / report.inflows : null;
  const previousMargin = previous && previous.inflows > 0 ? previous.net / previous.inflows : null;
  const marginPoints = margin !== null && previousMargin !== null ? (margin - previousMargin) * 100 : null;
  const incomeDelta = change(report.inflows, previous?.inflows);
  const expenseDelta = change(report.outflows, previous?.outflows);
  const netDelta = change(report.net, previous?.net);
  const versus = previous ? `vs. ${tick(previous.month).toLowerCase()}` : "sin mes anterior";
  const months = [
    ...history.filter((row) => row.month < monthKey).map((row) => ({ label: tick(row.month), inflows: row.inflows, outflows: row.outflows })),
    { label: tick(monthKey), inflows: report.inflows, outflows: report.outflows },
  ];
  const mix = categorySlices(report.categories);
  const period = report.firstDay && report.lastDay ? `${formatDay(report.firstDay)} – ${formatDay(report.lastDay)}` : monthName(monthKey);
  const incomeLines = report.incomeCategories.filter((row) => row.category !== "Sin categoría");
  const expenseLines = report.categories.filter((row) => row.category !== "Sin categoría");
  const classifiedIncome = incomeLines.reduce((sum, row) => sum + row.totalCents, 0);
  const classifiedExpense = expenseLines.reduce((sum, row) => sum + row.totalCents, 0);
  const classifiedNet = classifiedIncome - classifiedExpense;
  const asideIncome = report.uncategorizedIncomeCents;
  const asideExpense = report.uncategorizedExpenseCents;
  const uncategorized = asideExpense > 0 || asideIncome > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3" data-testid="report-hero">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
            <BarChart3 className="size-5 text-[#6f93b3]" /> Reportes
          </h1>
          <p className="mt-1 text-sm text-slate-500">Analiza el desempeño de {companyName} con los movimientos guardados.</p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-600">
          <Calendar className="size-4 text-slate-400" /> {period}
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={item.id === tab ? "rounded-full bg-[#c5d7e6] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-stone-900" : "rounded-full px-3 py-1.5 text-xs whitespace-nowrap text-slate-500 hover:bg-white"}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pyg" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Ingresos" value={formatUsd(report.inflows)} delta={incomeDelta} kind="income" versus={versus} />
            <Kpi label="Gastos" value={formatUsd(report.outflows)} delta={expenseDelta} kind="expense" versus={versus} />
            <Kpi label="Utilidad neta" value={formatUsd(report.net)} delta={netDelta} kind="net" versus={versus} testId="report-net" />
            <Kpi
              label="Margen neto"
              value={margin === null ? "—" : `${(margin * 100).toFixed(1)}%`}
              delta={null}
              kind="net"
              versus={marginPoints === null ? versus : `${marginPoints > 0 ? "+" : ""}${marginPoints.toFixed(1)} pp ${versus}`}
              points={marginPoints}
            />
          </section>

          <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <article className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Pérdidas y Ganancias</h2>
                <p className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#8eafc8]" /> Ingresos</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#d7e5f0]" /> Gastos</span>
                </p>
              </div>
              <MonthBars months={months} />
            </article>
            <article className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-sm font-semibold">Gastos por categoría</h2>
              <CategoryDonut total={mix.total} slices={mix.slices} />
            </article>
          </section>

          <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <article className="overflow-hidden rounded-2xl border border-border bg-white">
              <h2 className="px-5 pt-5 text-sm font-semibold">Estado de resultados</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-y border-border">
                    <th className="px-5 py-2 font-medium">Concepto</th>
                    <th className="px-3 py-2 text-right font-medium">{monthName(monthKey)}</th>
                    <th className="px-3 py-2 text-right font-medium">{previous ? monthName(previous.month) : "Anterior"}</th>
                    <th className="px-5 py-2 text-right font-medium">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400" colSpan={4}>Ingresos</td>
                  </tr>
                  {incomeLines.map((line) => (
                    <StatementRow
                      key={`in-${line.category}`}
                      label={line.category}
                      current={line.totalCents}
                      previous={null}
                      kind="income"
                      muted
                    />
                  ))}
                  <StatementRow label="Total de ingresos" current={classifiedIncome} previous={asideIncome > 0 ? null : (previous?.inflows ?? null)} kind="income" />
                  <tr>
                    <td className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400" colSpan={4}>Gastos</td>
                  </tr>
                  {expenseLines.map((line) => (
                    <StatementRow
                      key={`out-${line.category}`}
                      label={`– ${line.category}`}
                      current={line.totalCents}
                      previous={previous?.categories.find((row) => row.category === line.category)?.totalCents ?? null}
                      kind="expense"
                      muted
                    />
                  ))}
                  <StatementRow label="Total de gastos" current={classifiedExpense} previous={asideExpense > 0 ? null : (previous?.outflows ?? null)} kind="expense" />
                  <StatementRow label="Utilidad de lo clasificado" current={classifiedNet} previous={uncategorized ? null : (previous?.net ?? null)} kind="net" emphasis />
                </tbody>
              </table>
              {asideIncome > 0 || asideExpense > 0 ? (
                <p className="px-5 py-4 text-sm leading-6 text-slate-600" data-testid="report-uncategorized">
                  Fuera de este estado, porque todavía no tienen categoría:{" "}
                  {[asideIncome > 0 ? `${formatUsd(asideIncome)} de ingresos` : null, asideExpense > 0 ? `${formatUsd(asideExpense)} de gastos` : null].filter(Boolean).join(" y ")}.
                  No entran en la utilidad de arriba.
                </p>
              ) : null}
            </article>
            <article className="rounded-2xl border border-[#d7e5f0] bg-[#eef4f8] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <Sparkles className="size-4 text-[#6f93b3]" /> Conclusión del mes
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{headline(current, previous)} {subline(current, previous)}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium">
                <button type="button" onClick={() => setDetail((open) => !open)} className="text-[#4f7596]">
                  {detail ? "Ocultar análisis" : "Ver análisis completo →"}
                </button>
                {uncategorized ? <Link href="/movimientos?filtro=sin-categoria" className="text-slate-600">Clasificar</Link> : null}
              </div>
            </article>
          </section>
          {detail ? <Detail groups={report.groups} /> : null}
        </>
      ) : null}

      {tab === "balance" ? <Balance report={report} /> : null}
      {tab === "flujo" ? <CashFlow report={report} runway={cashDays(report.storedBalanceCents, report.outflows, Math.max(report.daily.length, 1))} /> : null}
      {tab === "cobrar" ? <DeskPanel title="Cuentas por cobrar" desk={receivable} href="/por-cobrar" empty="No hay facturas por cobrar." noun="por cobrar" /> : null}
      {tab === "pagar" ? (
        <div className="space-y-3">
          <DeskPanel title="Cuentas por pagar" desk={payable} href="/por-pagar" empty="No hay facturas por pagar." noun="por pagar" />
          <article className="rounded-2xl border border-border bg-white p-5">
            <h2 className="text-sm font-semibold">Gastos fijos del mes</h2>
            <p className="mt-2 text-sm text-slate-600">
              {fixed.pendingCents > 0 ? `Faltan ${formatUsd(fixed.pendingCents)}.` : "No hay gastos fijos pendientes."}
              {fixed.overdueCount > 0 ? ` ${fixed.overdueCount} vencidos por ${formatUsd(fixed.overdueCents)}.` : ""}
            </p>
            <Link href="/por-pagar" className="mt-3 inline-flex text-xs font-medium text-[#4f7596]">Abrir por pagar</Link>
          </article>
        </div>
      ) : null}
      {tab === "impuestos" ? (
        <article className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold">Impuestos</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Este laboratorio no calcula impuestos. Los movimientos y las facturas son de demostración y no generan una declaración.</p>
        </article>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  kind,
  versus,
  points,
  testId,
}: {
  label: string;
  value: string;
  delta: number | null;
  kind: "income" | "expense" | "net";
  versus: string;
  points?: number | null;
  testId?: string;
}) {
  const caption = points !== undefined
    ? versus
    : delta === null
      ? versus
      : `${percentLabel(delta)} ${versus}`;
  return (
    <article className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p data-testid={testId} className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-xs font-medium ${points !== undefined ? tone("net", points ?? null) : tone(kind, delta)}`}>{caption}</p>
    </article>
  );
}

function MonthBars({ months }: { months: { label: string; inflows: number; outflows: number }[] }) {
  const max = Math.max(...months.flatMap((month) => [month.inflows, month.outflows]), 1);
  if (months.length === 0) return <p className="mt-4 text-sm text-slate-500">No hay meses para comparar.</p>;
  return (
    <div className="mt-6 flex h-52 items-end gap-3">
      {months.map((month) => (
        <div key={month.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-44 w-full items-end justify-center gap-1">
            <div className="w-5 rounded-t-md bg-[#8eafc8]" style={{ height: `${Math.max(4, (month.inflows / max) * 168)}px` }} title={`Ingresos ${formatUsd(month.inflows)}`} />
            <div className="w-5 rounded-t-md bg-[#d7e5f0]" style={{ height: `${Math.max(4, (month.outflows / max) * 168)}px` }} title={`Gastos ${formatUsd(month.outflows)}`} />
          </div>
          <p className="text-[11px] text-slate-500">{month.label}</p>
        </div>
      ))}
    </div>
  );
}

function categorySlices(categories: { category: string; totalCents: number }[]) {
  const sorted = [...categories].sort((a, b) => b.totalCents - a.totalCents);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((sum, row) => sum + row.totalCents, 0);
  const rows = rest > 0 ? [...top, { category: "Otros", totalCents: rest }] : top;
  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const slices = rows.map((row, index) => ({
    label: row.category,
    cents: row.totalCents,
    share: total > 0 ? (row.totalCents / total) * 100 : 0,
    color: row.category === "Sin categoría" ? "#cbd5e1" : SLICE_COLORS[index % SLICE_COLORS.length],
  }));
  return { total, slices };
}

function CategoryDonut({ total, slices }: { total: number; slices: { label: string; cents: number; share: number; color: string }[] }) {
  if (total === 0) return <p className="mt-4 text-sm text-slate-500">No hay gastos en los movimientos guardados.</p>;
  let cursor = 0;
  const stops = slices.map((slice) => {
    const start = cursor;
    cursor += slice.share;
    return `${slice.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="relative grid size-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
        <div className="grid size-20 place-items-center rounded-full bg-white text-center">
          <span>
            <span className="block text-[10px] text-slate-400">Total</span>
            <span className="block text-xs font-semibold tabular-nums">{compact(total)}</span>
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">{slice.share.toFixed(1)}% · {formatUsd(slice.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatementRow({
  label,
  current,
  previous,
  kind,
  muted,
  emphasis,
}: {
  label: string;
  current: number;
  previous: number | null;
  kind: "income" | "expense" | "net";
  muted?: boolean;
  emphasis?: boolean;
}) {
  const delta = change(current, previous);
  return (
    <tr className={emphasis ? "bg-[#eef4f8] font-semibold" : "border-b border-border last:border-0"}>
      <td className={`px-5 py-2.5 ${muted ? "text-slate-500" : ""}`}>{label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatUsd(current)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{previous === null ? "—" : formatUsd(previous)}</td>
      <td className={`px-5 py-2.5 text-right text-xs font-medium tabular-nums ${tone(kind, delta)}`}>{percentLabel(delta)}</td>
    </tr>
  );
}

function Detail({ groups }: { groups: Report["groups"] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-white">
      <h2 className="px-5 pt-5 text-sm font-semibold">Detalle por subcategoría</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-y border-border">
            <th className="px-5 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Subcategoría</th>
            <th className="px-3 py-2 font-medium">Mov.</th>
            <th className="px-5 py-2 text-right font-medium">Gastos</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={`${group.category}/${group.subcategory}`} className="border-b border-border last:border-0">
              <td className="px-5 py-2">{group.category}</td>
              <td className="px-3 py-2">{group.subcategory}</td>
              <td className="px-3 py-2">{group.count}</td>
              <td className="px-5 py-2 text-right tabular-nums">{formatUsd(group.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function Balance({ report }: { report: Report }) {
  return (
    <section className="space-y-3">
      <article className="rounded-2xl border border-border bg-white p-5">
        <p className="text-xs text-slate-500">Saldo disponible en bancos</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{formatUsd(report.storedBalanceCents)}</p>
        <p className="mt-1 text-xs text-slate-500">Es el saldo guardado en cada cuenta. No es un balance con activos, pasivos y capital.</p>
      </article>
      <div className="grid gap-3 sm:grid-cols-2">
        {report.accounts.map((account) => (
          <article key={account.id} className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-medium">{account.institution} ····{account.mask}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{formatUsd(account.availableBalanceCents)}</p>
            <p className="text-xs text-slate-500">Neto de sus movimientos {formatUsd(account.net)}.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CashFlow({ report, runway }: { report: Report; runway: number | null }) {
  const weeks = weekly(report.daily);
  const steps = waterfall({ closingCents: report.storedBalanceCents, inflows: report.inflows, categories: report.categories });
  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      <article className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold">Por semana del periodo</h2>
        <p className="mt-1 text-xs text-slate-500">{runway === null ? "No hay ritmo de gasto para estimar la caja." : `Con este ritmo, el saldo alcanza para ${runway} días.`}</p>
        <WeekBars weeks={weeks} />
      </article>
      <article className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold">Del saldo inicial al final</h2>
        <ul className="mt-3 space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{step.label}</span>
              <span className={`tabular-nums ${step.kind === "down" ? "text-rose-600" : step.kind === "up" ? "text-emerald-600" : "font-medium"}`}>{formatUsd(step.value)}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function WeekBars({ weeks }: { weeks: { label: string; inflows: number; outflows: number }[] }) {
  const max = Math.max(...weeks.flatMap((week) => [week.inflows, week.outflows]), 1);
  if (weeks.length === 0) return <p className="mt-4 text-sm text-slate-500">No hay movimientos en el periodo.</p>;
  return (
    <div className="mt-4 flex h-40 items-end gap-3">
      {weeks.map((week) => (
        <div key={week.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center gap-1">
            <div className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(3, (week.inflows / max) * 120)}px` }} title={formatUsd(week.inflows)} />
            <div className="w-3 rounded-t bg-rose-300" style={{ height: `${Math.max(3, (week.outflows / max) * 120)}px` }} title={formatUsd(week.outflows)} />
          </div>
          <p className="text-[11px] text-slate-500">{week.label}</p>
        </div>
      ))}
    </div>
  );
}

function DeskPanel({ title, desk, href, empty, noun }: { title: string; desk: Desk; href: string; empty: string; noun: string }) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desk.invoiceCount === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <figure><figcaption className="text-xs text-slate-500">Facturado</figcaption><p className="mt-1 text-xl font-semibold tabular-nums">{formatUsd(desk.totalCents)}</p></figure>
          <figure><figcaption className="text-xs text-slate-500">Abierto</figcaption><p className="mt-1 text-xl font-semibold tabular-nums">{formatUsd(desk.openCents)}</p></figure>
          <figure><figcaption className="text-xs text-slate-500">Conciliado</figcaption><p className="mt-1 text-xl font-semibold tabular-nums">{formatUsd(desk.matchedCents)}</p></figure>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">{desk.invoiceCount} facturas {noun}.</p>
      <Link href={href} className="mt-3 inline-flex text-xs font-medium text-[#4f7596]">Abrir la carpeta</Link>
    </article>
  );
}

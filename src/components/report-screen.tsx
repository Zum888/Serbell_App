import { CalendarClock, Copy, Gauge, Receipt, Sparkles, Tag } from "lucide-react";
import Link from "next/link";
import { monthName, shortMonth } from "@/lib/fixed";
import { cashDays, change, headline, percentLabel, subline, waterfall, weekly, type MonthTotals } from "@/lib/insights";
import { formatUsd } from "@/lib/money";
import type { companyReport } from "@/server/queries";
import type { monthHistory } from "@/server/planning";

type Report = Awaited<ReturnType<typeof companyReport>>;
type History = Awaited<ReturnType<typeof monthHistory>>;

function compact(cents: number): string {
  const value = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (value >= 1_000_000) return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${sign}$${(value / 1_000).toFixed(1)}k`;
  return `${sign}$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function ReportScreen({
  companyName,
  report,
  history,
  fixed,
}: {
  companyName: string;
  report: Report;
  history: History;
  fixed: { pendingCents: number; overdueCents: number; overdueCount: number };
}) {
  const monthKey = (report.lastDay ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
  const current: MonthTotals = { month: monthKey, inflows: report.inflows, outflows: report.outflows, net: report.net };
  const previous = history.filter((row) => row.month < monthKey).at(-1) ?? null;
  const margin = report.inflows > 0 ? report.net / report.inflows : null;
  const runway = cashDays(report.storedBalanceCents, report.outflows, Math.max(report.daily.length, 1));
  const uncategorizedShare = report.outflows > 0 ? report.uncategorizedExpenseCents / report.outflows : 0;
  const steps = waterfall({ closingCents: report.storedBalanceCents, inflows: report.inflows, categories: report.categories });
  const weeks = weekly(report.daily);
  const biggest = report.largestExpenses[0] ?? null;

  const signals: { icon: typeof Sparkles; tone: string; title: string; body: string; href?: string; cta?: string }[] = [];
  if (uncategorizedShare > 0) {
    signals.push({
      icon: Tag,
      tone: "text-amber-600 bg-amber-50",
      title: `${Math.round(uncategorizedShare * 100)}% del gasto sin categoría`,
      body: `${formatUsd(report.uncategorizedExpenseCents)} todavía no tiene categoría. Las comparaciones por categoría se afinan al clasificarlo.`,
      href: "/movimientos",
      cta: "Clasificar",
    });
  }
  if (fixed.pendingCents > 0) {
    signals.push({
      icon: CalendarClock,
      tone: fixed.overdueCount > 0 ? "text-rose-600 bg-rose-50" : "text-blue-600 bg-blue-50",
      title: `Faltan ${formatUsd(fixed.pendingCents)} de gastos fijos`,
      body: fixed.overdueCount > 0 ? `${fixed.overdueCount} vencidos por ${formatUsd(fixed.overdueCents)}. Revisa si ya se pagaron.` : "Todo al corriente. Ninguno vencido.",
      href: "/por-pagar",
      cta: "Ver checklist",
    });
  }
  if (biggest) {
    signals.push({
      icon: Receipt,
      tone: "text-slate-700 bg-slate-100",
      title: `Gasto más grande: ${biggest.merchant}`,
      body: `${formatUsd(Math.abs(biggest.amountCents))} el ${biggest.postedOn} · ${biggest.category}.`,
      href: `/movimientos?movimiento=${biggest.id}`,
      cta: "Ver movimiento",
    });
  }
  if (report.duplicates.length > 0) {
    signals.push({
      icon: Copy,
      tone: "text-violet-600 bg-violet-50",
      title: `${report.duplicates.length} comprobante${report.duplicates.length === 1 ? "" : "s"} duplicado${report.duplicates.length === 1 ? "" : "s"}`,
      body: "Serbell los detectó para que no se cuenten dos veces.",
      href: "/comprobantes",
      cta: "Revisar",
    });
  }
  if (runway !== null) {
    signals.push({
      icon: Gauge,
      tone: runway < 60 ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50",
      title: `${runway} días de caja`,
      body: `Con el ritmo de gasto de este mes (${formatUsd(Math.round(report.outflows / Math.max(report.daily.length, 1)))} por día), el saldo actual alcanza para ese tiempo.`,
    });
  }

  const incomeDelta = change(report.inflows, previous?.inflows);
  const expenseDelta = change(report.outflows, previous?.outflows);
  const netDelta = change(report.net, previous?.net);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[28px] bg-[#0b1220] px-6 py-8 text-white sm:px-8" data-testid="report-hero">
          <div className="pointer-events-none absolute -right-16 top-0 size-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-200/80">
            <Sparkles className="size-3.5" /> {companyName}
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{headline(current, previous)}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{subline(current, previous)}</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <HeroFigure label="Ingresos" value={formatUsd(report.inflows)} delta={incomeDelta} tone="text-emerald-300" />
            <HeroFigure label="Gastos" value={formatUsd(report.outflows)} delta={expenseDelta} tone="text-rose-200" />
            <HeroFigure label="Neto" value={formatUsd(report.net)} delta={netDelta} tone="text-white" testId="report-net" />
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            {monthName(monthKey)} · {report.count} movimientos
            {margin === null ? "" : ` · margen ${Math.round(margin * 100)}%`}
            {runway === null ? "" : ` · ${runway} días de caja`}.
          </p>
        </section>
        <article className="rounded-[28px] border border-border bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold tracking-tight">Cómo se movió el dinero</h2>
            <p className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-500" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-rose-400" /> Salidas</span>
            </p>
          </div>
          <WeeklyChart weeks={weeks} />
        </article>
        <article className="rounded-[28px] border border-border bg-white p-6">
          <h2 className="text-base font-semibold tracking-tight">A dónde se fue el gasto</h2>
          <CategoryMix categories={report.categories} previous={previous?.categories ?? null} previousLabel={previous ? shortMonth(previous.month) : null} />
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">De dónde vino el saldo</summary>
            <Waterfall steps={steps} />
          </details>
        </article>
      </div>
      <aside className="space-y-3" data-testid="report-signals">
        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Para resolver</p>
        {signals.length === 0 ? <p className="rounded-2xl border border-border bg-white p-4 text-sm text-slate-500">Nada pendiente en esta lectura.</p> : null}
        {signals.map((signal) => (
          <article key={signal.title} className="rounded-2xl border border-border bg-white p-4">
            <span className={`grid size-8 place-items-center rounded-full ${signal.tone}`}><signal.icon className="size-4" /></span>
            <p className="mt-3 text-sm font-semibold leading-5">{signal.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{signal.body}</p>
            {signal.href ? <Link href={signal.href} className="mt-3 inline-flex text-xs font-medium text-primary">{signal.cta}</Link> : null}
          </article>
        ))}
      </aside>

      <details className="rounded-2xl border border-border bg-white xl:col-span-2">
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

function HeroFigure({ label, value, delta, tone, testId }: { label: string; value: string; delta: number | null; tone: string; testId?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p data-testid={testId} className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${tone}`}>{value}</p>
      {delta !== null ? (
        <p className={`mt-1 text-xs ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{percentLabel(delta)} vs. el mes anterior</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Sin mes anterior</p>
      )}
    </div>
  );
}

function WeeklyChart({ weeks }: { weeks: { label: string; inflows: number; outflows: number }[] }) {
  const max = Math.max(...weeks.flatMap((week) => [week.inflows, week.outflows]), 1);
  if (weeks.length === 0) return <p className="mt-4 text-sm text-slate-500">No hay movimientos.</p>;
  return (
    <div className="mt-4">
      <div className="flex h-44 items-end gap-4 border-b border-slate-200 pb-px">
        {weeks.map((week) => (
          <div key={week.label} className="group relative flex flex-1 items-end justify-center gap-1">
            <div className="w-1/2 max-w-7 rounded-t-md bg-emerald-500" style={{ height: `${(week.inflows / max) * 168}px` }} title={`Entradas ${formatUsd(week.inflows)}`} />
            <div className="w-1/2 max-w-7 rounded-t-md bg-rose-400" style={{ height: `${(week.outflows / max) * 168}px` }} title={`Salidas ${formatUsd(week.outflows)}`} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-4">
        {weeks.map((week) => {
          const net = week.inflows - week.outflows;
          return (
            <div key={week.label} className="flex-1 text-center">
              <p className="text-[11px] text-slate-500">Días {week.label}</p>
              <p className={`text-[11px] font-semibold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{compact(net)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Waterfall({ steps }: { steps: ReturnType<typeof waterfall> }) {
  const levels = steps.flatMap((step) => (step.kind === "total" ? [step.end] : [step.start, step.end]));
  const top = Math.max(...levels, 1);
  const low = Math.min(...levels);
  const truncated = low > 0 && (top - low) / top < 0.5;
  const bottom = truncated ? low - (top - low) * 0.6 : Math.min(0, low);
  const span = top - bottom || 1;
  const height = 168;
  const y = (value: number) => ((top - Math.max(value, bottom)) / span) * height;
  return (
    <div className="mt-3">
      <div className="relative flex h-[168px] items-stretch gap-2">
        {steps.map((step) => {
          const high = Math.max(step.start, step.end);
          const floor = Math.min(step.start, step.end);
          const color = step.kind === "total" ? "bg-slate-800" : step.kind === "up" ? "bg-emerald-500" : "bg-rose-400";
          return (
            <div key={step.label} className="relative flex-1" title={`${step.label}: ${formatUsd(step.value)}`}>
              <div className={`absolute inset-x-0 rounded-md ${color}`} style={{ top: y(high), height: Math.max(3, y(floor) - y(high)) }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {steps.map((step) => (
          <div key={step.label} className="min-w-0 flex-1 text-center">
            <p className="truncate text-[10px] text-slate-500" title={step.label}>{step.label}</p>
            <p className={`text-[10px] font-semibold tabular-nums ${step.kind === "down" ? "text-rose-600" : step.kind === "up" ? "text-emerald-600" : "text-slate-800"}`}>
              {compact(step.value)}
            </p>
          </div>
        ))}
      </div>
      {truncated ? <p className="mt-2 text-[10px] text-slate-400">El eje empieza en {compact(Math.round(bottom))} para que se vean los cambios del mes.</p> : null}
    </div>
  );
}

const MIX_COLORS = ["#0f172a", "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#a855f7"];

function CategoryMix({
  categories,
  previous,
  previousLabel,
}: {
  categories: { category: string; totalCents: number }[];
  previous: { category: string; totalCents: number }[] | null;
  previousLabel: string | null;
}) {
  const total = categories.reduce((sum, row) => sum + row.totalCents, 0);
  if (total === 0) return <p className="mt-3 text-sm text-slate-500">No hay gastos en los movimientos guardados.</p>;
  return (
    <div className="mt-3">
      <div className="flex h-3 overflow-hidden rounded-full">
        {categories.map((row, index) => (
          <div key={row.category} style={{ width: `${(row.totalCents / total) * 100}%`, background: row.category === "Sin categoría" ? "#cbd5e1" : MIX_COLORS[index % MIX_COLORS.length] }} title={row.category} />
        ))}
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-border">
            <th className="py-2 text-left font-medium">Categoría</th>
            <th className="py-2 text-right font-medium">Este mes</th>
            <th className="py-2 text-right font-medium">Peso</th>
            {previousLabel ? <th className="py-2 text-right font-medium">vs {previousLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {categories.map((row, index) => {
            const before = previous?.find((item) => item.category === row.category)?.totalCents ?? null;
            const delta = row.category === "Sin categoría" ? null : change(row.totalCents, before);
            return (
              <tr key={row.category} className="border-b border-border last:border-0">
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: row.category === "Sin categoría" ? "#cbd5e1" : MIX_COLORS[index % MIX_COLORS.length] }} />
                    {row.category}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{formatUsd(row.totalCents)}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">{Math.round((row.totalCents / total) * 100)}%</td>
                {previousLabel ? (
                  <td className={`py-2 text-right text-xs font-medium tabular-nums ${delta === null ? "text-slate-400" : delta > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {percentLabel(delta)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

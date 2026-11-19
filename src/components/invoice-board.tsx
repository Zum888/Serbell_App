"use client";

import { Calendar, Clock, Layers, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { InvoiceFolders } from "@/components/invoice-desk";
import { shortMonth } from "@/lib/fixed";
import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import type { Approval } from "@/lib/approval";
import type { InvoiceFolder } from "@/server/invoices";

export type DeskRow = {
  id: string;
  number: string;
  partyId: string;
  partyName: string;
  issuedOn: string;
  dueOn: string;
  amountCents: number;
  matched: boolean;
  approval: Approval;
  followUpAt: string | null;
};

type DueState = "vencida" | "por_vencer" | "al_dia";
type Tab = "facturas" | "partes" | "seguimiento";
type DueFilter = "todas" | DueState;
type Suggestion = { title: string; detail: string; href?: string; filter?: DueFilter | "seguimiento" };

const DUE_LABEL: Record<DueState, string> = {
  vencida: "Vencida",
  por_vencer: "Por vencer",
  al_dia: "Al día",
};

const DUE_TONE: Record<DueState, string> = {
  vencida: "bg-rose-50 text-rose-700",
  por_vencer: "bg-sky-50 text-sky-700",
  al_dia: "bg-emerald-50 text-emerald-700",
};

function dayDiff(from: string, to: string) {
  const start = Date.parse(`${from}T12:00:00.000Z`);
  const end = Date.parse(`${to}T12:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function dueState(row: DeskRow, today: string): DueState {
  const days = dayDiff(today, row.dueOn);
  if (days <= 0) return "vencida";
  if (days <= 14) return "por_vencer";
  return "al_dia";
}

function dueLabel(due: string, today: string) {
  if (due === today) return `Hoy, ${formatDay(due).replace(/ \d{4}$/, "")}`;
  return formatDay(due);
}

function share(part: number, total: number) {
  if (total <= 0) return "0% del total";
  return `${Math.round((part / total) * 100)}% del total`;
}

function lastMonths(today: string, count = 6) {
  const [year, month] = today.split("-").map(Number);
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(new Date(Date.UTC(year, (month ?? 1) - 1 - index, 1)).toISOString().slice(0, 7));
  }
  return months;
}

function monthTick(period: string) {
  const label = shortMonth(period);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : period;
}

export function InvoiceBoard({
  title,
  subtitle,
  partyNoun,
  partiesLabel,
  chartTitle,
  today,
  base,
  rows,
  folders,
  pins = [],
  activeId,
  extraSuggestions = [],
}: {
  title: string;
  subtitle: string;
  partyNoun: string;
  partiesLabel: string;
  chartTitle: string;
  today: string;
  base: string;
  rows: DeskRow[];
  folders: InvoiceFolder[];
  pins?: { id: string; name: string; totalCents: number; detail: string; href: string }[];
  activeId?: string;
  extraSuggestions?: Suggestion[];
}) {
  const [tab, setTab] = useState<Tab>("facturas");
  const [query, setQuery] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("todas");
  const [thisMonth, setThisMonth] = useState(false);
  const monthKey = today.slice(0, 7);
  const openRows = rows.filter((row) => !row.matched);
  const pending = openRows.reduce((sum, row) => sum + row.amountCents, 0);
  const overdueRows = openRows.filter((row) => dueState(row, today) === "vencida");
  const overdue = overdueRows.reduce((sum, row) => sum + row.amountCents, 0);
  const upcoming = pending - overdue;
  const months = lastMonths(today);
  const series = months.map((month) => ({
    month,
    cents: rows.filter((row) => row.issuedOn.startsWith(month)).reduce((sum, row) => sum + row.amountCents, 0),
  }));
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter((row) => (dueFilter === "todas" ? true : dueState(row, today) === dueFilter))
      .filter((row) => (thisMonth ? row.dueOn.startsWith(monthKey) : true))
      .filter((row) => {
        if (!needle) return true;
        const amount = formatUsd(row.amountCents).toLowerCase();
        return row.partyName.toLowerCase().includes(needle) || row.number.toLowerCase().includes(needle) || amount.includes(needle);
      })
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.partyName.localeCompare(b.partyName, "es"));
  }, [rows, query, dueFilter, thisMonth, monthKey, today]);
  const watching = rows.filter((row) => row.followUpAt || (!row.matched && dueState(row, today) === "vencida"));
  const suggestions = buildSuggestions(overdueRows, openRows, today, extraSuggestions);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Buscar factura, ${partyNoun.toLowerCase()} o monto`}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm sm:w-72"
          aria-label="Buscar facturas"
        />
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi icon={<Layers className="size-4 text-blue-600" />} label="Total pendiente" value={formatUsd(pending)} note={`${openRows.length} facturas abiertas`} testId="desk-pending" />
            <Kpi icon={<Clock className="size-4 text-rose-600" />} label="Vencido" value={formatUsd(overdue)} note={share(overdue, pending)} />
            <Kpi icon={<Calendar className="size-4 text-sky-600" />} label="Por vencer" value={formatUsd(upcoming)} note={share(upcoming, pending)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-sm">
              <TabButton active={tab === "facturas"} onClick={() => setTab("facturas")}>Facturas</TabButton>
              <TabButton active={tab === "partes"} onClick={() => setTab("partes")}>{partiesLabel}</TabButton>
              <TabButton active={tab === "seguimiento"} onClick={() => setTab("seguimiento")}>Seguimiento</TabButton>
            </div>
            {tab === "facturas" ? (
              <div className="flex gap-2">
                <select
                  value={dueFilter}
                  onChange={(event) => setDueFilter(event.target.value as DueFilter)}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  aria-label="Filtrar por estado"
                >
                  <option value="todas">Todas las facturas</option>
                  <option value="vencida">Vencidas</option>
                  <option value="por_vencer">Por vencer</option>
                  <option value="al_dia">Al día</option>
                </select>
                <select
                  value={thisMonth ? "mes" : "todos"}
                  onChange={(event) => setThisMonth(event.target.value === "mes")}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  aria-label="Filtrar por mes"
                >
                  <option value="todos">Todos los meses</option>
                  <option value="mes">Este mes</option>
                </select>
              </div>
            ) : null}
          </div>

          {tab === "facturas" ? (
            <InvoiceTable rows={filtered} total={rows.length} base={base} today={today} partyNoun={partyNoun} activeId={activeId} />
          ) : null}
          {tab === "partes" ? (
            folders.length === 0 && pins.length === 0 ? (
              <p className="rounded-2xl border border-border bg-white p-4 text-sm text-slate-500">No hay {partiesLabel.toLowerCase()} con facturas.</p>
            ) : (
              <InvoiceFolders folders={folders} base={base} pins={pins} />
            )
          ) : null}
          {tab === "seguimiento" ? (
            watching.length === 0 ? (
              <p className="rounded-2xl border border-border bg-white p-4 text-sm text-slate-500">No hay facturas vencidas ni marcadas en seguimiento.</p>
            ) : (
              <InvoiceTable rows={watching} total={watching.length} base={base} today={today} partyNoun={partyNoun} activeId={activeId} followUp />
            )
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-medium">{chartTitle}</p>
            <p className="text-xs text-slate-400">Últimos 6 meses, por fecha de emisión</p>
            <ColumnChart series={series} />
          </div>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-violet-600" /> Sugerencias de Serbell
            </p>
            {suggestions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No hay facturas abiertas que pedir.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {suggestions.map((item) => (
                  <li key={item.title} className="py-2">
                    {item.href ? (
                      <Link href={item.href} className="block hover:text-primary">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="block text-xs text-slate-500">{item.detail}</span>
                      </Link>
                    ) : item.filter ? (
                      <button type="button" onClick={() => applySuggestion(item, setTab, setDueFilter)} className="block text-left hover:text-primary">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="block text-xs text-slate-500">{item.detail}</span>
                      </button>
                    ) : (
                      <p>
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="block text-xs text-slate-500">{item.detail}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function applySuggestion(
  item: Suggestion,
  setTab: (tab: Tab) => void,
  setDueFilter: (filter: DueFilter) => void,
) {
  if (item.filter === "seguimiento") {
    setTab("seguimiento");
    return;
  }
  setTab("facturas");
  if (item.filter) setDueFilter(item.filter);
}

function buildSuggestions(
  overdueRows: DeskRow[],
  openRows: DeskRow[],
  today: string,
  extra: Suggestion[],
) {
  const items: Suggestion[] = [];
  if (overdueRows.length > 0) {
    const count = overdueRows.length;
    const amount = overdueRows.reduce((sum, row) => sum + row.amountCents, 0);
    items.push({
      title: count === 1 ? "Revisar 1 factura vencida" : `Revisar ${count} facturas vencidas`,
      detail: `${formatUsd(amount)} en total`,
      filter: "vencida",
    });
  }
  const soon = openRows.filter((row) => dueState(row, today) === "por_vencer");
  if (soon.length > 0) {
    const amount = soon.reduce((sum, row) => sum + row.amountCents, 0);
    items.push({
      title: soon.length === 1 ? "1 factura vence en 14 días" : `${soon.length} facturas vencen en 14 días`,
      detail: formatUsd(amount),
      filter: "por_vencer",
    });
  }
  if (openRows.length > 0) {
    const span = openRows.reduce((sum, row) => sum + Math.max(0, dayDiff(row.issuedOn, row.dueOn)), 0);
    items.push({
      title: `Plazo promedio de ${Math.round(span / openRows.length)} días`,
      detail: "Entre la emisión y el vencimiento de las facturas abiertas.",
    });
  }
  return [...items, ...extra];
}

function InvoiceTable({
  rows,
  total,
  base,
  today,
  partyNoun,
  activeId,
  followUp = false,
}: {
  rows: DeskRow[];
  total: number;
  base: string;
  today: string;
  partyNoun: string;
  activeId?: string;
  followUp?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">{partyNoun}</th>
            <th className="px-4 py-2 font-medium">Factura</th>
            <th className="px-4 py-2 font-medium">Vencimiento</th>
            <th className="px-4 py-2 text-right font-medium">Monto</th>
            <th className="px-4 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-sm text-slate-500">Ninguna factura coincide con el filtro.</td>
            </tr>
          ) : rows.map((row) => {
            const state = dueState(row, today);
            return (
              <tr
                key={row.id}
                data-testid="invoice-row"
                onClick={() => router.push(`${base}?parte=${row.partyId}&factura=${row.id}`)}
                className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${activeId === row.id ? "bg-violet-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{row.partyName}</td>
                <td className="px-4 py-3 text-slate-600">{row.number}</td>
                <td className={`px-4 py-3 ${state === "vencida" ? "font-medium text-rose-600" : "text-slate-600"}`}>{dueLabel(row.dueOn, today)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(row.amountCents)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${DUE_TONE[state]}`}>{DUE_LABEL[state]}</span>
                  {followUp && row.followUpAt ? <span className="ml-2 text-xs text-slate-400">En seguimiento</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Mostrando {rows.length} de {total} facturas</p>
    </div>
  );
}

function Kpi({ icon, label, value, note, testId }: { icon: ReactNode; label: string; value: string; note: string; testId?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="grid size-8 place-items-center rounded-full bg-slate-50">{icon}</span>
        {label}
      </div>
      <p data-testid={testId} className="mt-3 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={active ? "border-b-2 border-blue-600 pb-1 font-medium text-blue-700" : "pb-1 text-slate-500"}>
      {children}
    </button>
  );
}

function ColumnChart({ series }: { series: { month: string; cents: number }[] }) {
  const max = Math.max(...series.map((item) => item.cents), 1);
  return (
    <div className="mt-4 flex h-36 items-end gap-2">
      {series.map((item, index) => (
        <div key={item.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t-md"
            style={{
              height: item.cents === 0 ? "0%" : `${Math.max(8, (item.cents / max) * 100)}%`,
              background: index === series.length - 1 ? "#6d5efc" : "#ddd6fe",
            }}
            title={formatUsd(item.cents)}
          />
          <span className="text-[10px] text-slate-400">{monthTick(item.month)}</span>
        </div>
      ))}
    </div>
  );
}

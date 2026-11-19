"use client";

import { Calendar, CreditCard, LayoutGrid, Plus, Search, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AreaChart } from "@/components/charts";
import { DuplicatePanel } from "@/components/duplicate-panel";
import { MissingPanel } from "@/components/missing-panel";
import { MovementsTable } from "@/components/movements-table";
import { StateView } from "@/components/state-view";
import { Input } from "@/components/ui/input";
import { accountInitials } from "@/lib/accounts";
import { DUPLICATE_IDS } from "@/lib/duplicates";
import { MISSING_IDS } from "@/lib/missing-receipts";
import { formatUsd } from "@/lib/money";

type Row = {
  id: string;
  accountId: string;
  accountingState: string;
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
  category: string | null;
  subcategory: string | null;
  subcategoryId: string;
  documentState: string;
  reviewState: string;
  reconciliationState: string;
  serbellConciled: boolean;
  sealed: boolean;
  institution: string;
  mask: string;
  documentId: string | null;
  documentName: string | null;
  invoiceNumber: string | null;
  comment: string | null;
  suggested: boolean;
};

type Account = { id: string; institution: string; mask: string; availableBalanceCents: number };

const filters = [
  ["todos", "Todos"],
  ["sin-categoria", "Sin categorizar"],
  ["sin-comprobante", "Sin comprobantes"],
  ["por-conciliar", "Por conciliar"],
  ["por-revisar", "Por revisar"],
  ["aprobados", "Aprobados"],
] as const;

const periods = [
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "3 meses"],
  ["year", "Este año"],
] as const;

type Span = (typeof periods)[number][0] | "custom";

export function BankLedger({
  companyName,
  companyId,
  accounts,
  accountId: initialAccountId,
  rows,
  categories,
  canReview,
  filter: initialFilter,
  q: initialQuery,
  found = [],
  notice,
  duplicate = false,
  decision,
  missing = false,
  error,
  withChat = false,
  flujo,
}: {
  companyName: string;
  companyId: string;
  accounts: Account[];
  accountId?: string;
  rows: Row[];
  categories: { id: string; name: string; children?: { id: string; name: string; children?: { id: string; name: string }[] }[] }[];
  canReview: boolean;
  filter: string;
  q: string;
  found?: string[];
  notice?: "factura" | "lote";
  duplicate?: boolean;
  decision?: string;
  missing?: boolean;
  error?: string;
  withChat?: boolean;
  flujo?: string;
}) {
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [filter, setFilter] = useState(initialFilter || "todos");
  const [query, setQuery] = useState(initialQuery);
  const [span, setSpan] = useState<Span>("30");
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const selected = accounts.find((account) => account.id === accountId) ?? null;
  const ofAccount = accountId ? rows.filter((row) => row.accountId === accountId) : rows;
  const anchor = latestDay(ofAccount.length ? ofAccount : rows);
  const { start, end } = rangeFor(anchor, span, custom);
  const periodRows = ofAccount.filter((row) => row.postedOn >= start && row.postedOn <= end);
  const counts = totals(periodRows);
  const needle = query.trim().toLowerCase();
  const spotlight = duplicate ? (DUPLICATE_IDS as readonly string[]) : missing ? MISSING_IDS : found;
  const inPeriod = new Set(periodRows.map((row) => row.id));
  const carried = spotlight.length
    ? ofAccount.filter((row) => spotlight.includes(row.id) && !inPeriod.has(row.id) && matches(row, filter, needle))
    : [];
  const visible = [...carried, ...periodRows.filter((row) => matches(row, filter, needle))];
  const ordered = spotlight.length
    ? [...visible.filter((row) => spotlight.includes(row.id)), ...visible.filter((row) => !spotlight.includes(row.id))]
    : visible;
  const ready = ofAccount.filter((row) => MISSING_IDS.includes(row.id) && row.documentState === "Linked").length;
  const allAvailable = accounts.reduce((sum, account) => sum + account.availableBalanceCents, 0);
  const availableCents = selected ? selected.availableBalanceCents : allAvailable;
  const lines = seriesFor(periodRows, start, end, availableCents);
  const inflowDelta = deltaLabel(counts.inflows, sumSigned(ofAccount, start, end, "in", span));
  const outflowDelta = deltaLabel(counts.outflows, sumSigned(ofAccount, start, end, "out", span));
  const focusHref = `/movimientos?${new URLSearchParams({ vista: "enfoque", ...(withChat ? { con: "chat", ...(flujo ? { flujo } : {}) } : {}) }).toString()}`;
  const countFor: Record<string, number> = {
    todos: counts.todos,
    "sin-categoria": counts.sinCategoria,
    "sin-comprobante": counts.sinComprobante,
    "por-conciliar": counts.porConciliar,
    "por-revisar": counts.porRevisar,
    aprobados: counts.aprobados,
  };

  function remember(next: { cuenta?: string | null; filtro?: string; q?: string }) {
    const url = new URL(window.location.href);
    if (next.cuenta !== undefined) {
      if (next.cuenta) url.searchParams.set("cuenta", next.cuenta);
      else url.searchParams.delete("cuenta");
    }
    if (next.filtro !== undefined) {
      if (next.filtro && next.filtro !== "todos") url.searchParams.set("filtro", next.filtro);
      else url.searchParams.delete("filtro");
    }
    if (next.q !== undefined) {
      if (next.q) url.searchParams.set("q", next.q);
      else url.searchParams.delete("q");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{companyName}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bancos</h1>
          <p className="text-sm text-slate-500">{periodTitle(start, end, span)}</p>
          {selected && ofAccount.some((row) => row.reconciliationState !== "Reconciled") ? (
            <Link
              href={`/cuentas?${new URLSearchParams({ cuenta: selected.id, paso: "conciliar", ...(withChat ? { con: "chat", ...(flujo ? { flujo } : {}) } : {}) }).toString()}`}
              className="mt-1 inline-block text-xs font-medium text-stone-800"
            >
              Conciliar con el banco
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {periods.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSpan(key);
                setCalendarOpen(false);
              }}
              className={span === key ? "rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-[#f7f6f4]" : "rounded-full px-3 py-1.5 text-xs text-stone-500 hover:bg-white"}
            >
              {label}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              aria-label="Elegir fechas"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((open) => !open)}
              className={span === "custom" ? "grid size-8 place-items-center rounded-full bg-stone-900 text-[#f7f6f4]" : "grid size-8 place-items-center rounded-full border border-[#e6e1d8] bg-white text-stone-500"}
            >
              <Calendar className="size-4" />
            </button>
            {calendarOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                <label className="block text-xs text-slate-500">
                  Desde
                  <input type="date" defaultValue={start} id="bank-from" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                </label>
                <label className="mt-2 block text-xs text-slate-500">
                  Hasta
                  <input type="date" defaultValue={end} id="bank-to" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
                </label>
                <button
                  type="button"
                  className="mt-3 w-full rounded-full bg-stone-900 py-1.5 text-xs font-medium text-[#f7f6f4]"
                  onClick={() => {
                    const from = (document.getElementById("bank-from") as HTMLInputElement | null)?.value;
                    const to = (document.getElementById("bank-to") as HTMLInputElement | null)?.value;
                    if (!from || !to) return;
                    setCustom(from <= to ? { start: from, end: to } : { start: to, end: from });
                    setSpan("custom");
                    setCalendarOpen(false);
                  }}
                >
                  Ver esas fechas
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div data-testid="bank-totals" className="mt-4 grid gap-3 lg:grid-cols-3">
        <Metric
          icon={<TrendingUp className="size-3.5" />}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Ingresos"
          value={formatUsd(counts.inflows)}
          tone="text-slate-900"
          note={inflowDelta}
          noteClass="text-emerald-600"
          series={lines.inflows}
          color="#059669"
          fromZero
        />
        <Metric
          icon={<CreditCard className="size-3.5" />}
          iconClass="bg-rose-50 text-rose-600"
          label="Gastos"
          value={formatUsd(counts.outflows)}
          tone="text-slate-900"
          note={outflowDelta}
          noteClass="text-rose-600"
          series={lines.outflows}
          color="#e11d48"
          fromZero
        />
        <Metric
          icon={<Wallet className="size-3.5" />}
          iconClass="bg-[#efede8] text-stone-700"
          label="Disponible"
          value={formatUsd(availableCents)}
          tone="text-slate-900"
          note={selected ? "Esta cuenta" : `Las ${accounts.length} cuentas`}
          noteClass="text-stone-500"
          series={lines.balance}
          color="#57534e"
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <nav aria-label="Cambiar de cuenta" data-testid="account-switcher" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          <AccountTab
            active={!selected}
            title="Todas"
            detail={formatUsd(allAvailable)}
            onSelect={() => {
              setAccountId("");
              remember({ cuenta: null });
            }}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#efede8] text-stone-800"><LayoutGrid className="size-3.5" /></span>
          </AccountTab>
          {accounts.map((account) => (
            <AccountTab
              key={account.id}
              active={account.id === accountId}
              title={account.institution}
              detail={`···${account.mask} · ${formatUsd(account.availableBalanceCents)}`}
              wide
              onSelect={() => {
                setAccountId(account.id);
                remember({ cuenta: account.id });
              }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white" style={{ backgroundColor: bankAccent(account.institution) }}>{accountInitials(account.institution)}</span>
            </AccountTab>
          ))}
        </nav>
        <Link href="/cuentas/conectar" data-testid="add-account" className="shrink-0 px-2 text-sm text-slate-500 hover:text-slate-800">
          <Plus className="mr-1 inline size-3.5" /> Agregar cuenta
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5">
          <Link href={focusHref} className="rounded-full px-3 py-1.5 text-xs text-slate-500">Modo enfoque</Link>
          <span className="rounded-full bg-[#efede8] px-3 py-1.5 text-xs font-medium text-stone-800">Vista detallada</span>
        </div>
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              remember({ filtro: key });
            }}
            className={filter === key ? "rounded-full border border-stone-900 bg-white px-3 py-1.5 text-xs font-medium text-stone-900" : "rounded-full px-3 py-1.5 text-xs text-stone-500 hover:bg-white"}
          >
            {label}
            <span className="ml-1 tabular-nums text-slate-400">{countFor[key]}</span>
          </button>
        ))}
        <form
          className="relative ml-auto w-full sm:w-56"
          onSubmit={(event) => {
            event.preventDefault();
            remember({ q: query });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              remember({ q: event.target.value });
            }}
            placeholder="Buscar movimiento..."
            className="h-9 rounded-full pl-8"
          />
        </form>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {notice === "factura" ? <p data-testid="invoice-reconciled" className="px-4 pt-3 text-sm text-emerald-800">La factura quedó conciliada con el movimiento del banco.</p> : null}
        {notice === "lote" ? <p data-testid="batch-reconciled" className="px-4 pt-3 text-sm text-emerald-800">El lote quedó conciliado con los movimientos del banco.</p> : null}
        {duplicate ? <DuplicatePanel decision={decision} /> : null}
        {missing ? <MissingPanel ready={ready} /> : null}
        {error ? <div className="px-4 py-3"><StateView variant="error" title={error} testId="server-error" /></div> : null}
        {ordered.length === 0 ? (
          <div className="px-4 py-4">
            <StateView variant="empty" title="No hay movimientos con este filtro." />
          </div>
        ) : (
          <MovementsTable
            rows={ordered}
            categories={categories}
            canReview={canReview}
            filter={filter}
            q={query}
            companyId={companyId}
            accountId={accountId || undefined}
            showBank={!selected}
            marked={[...spotlight]}
          />
        )}
      </div>
    </section>
  );
}

function AccountTab({
  active,
  title,
  detail,
  wide,
  onSelect,
  children,
}: {
  active: boolean;
  title: string;
  detail: string;
  wide?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      className={`flex h-[52px] shrink-0 items-center gap-2 rounded-2xl border bg-white px-2.5 text-left ${wide ? "w-[210px]" : ""} ${active ? "border-stone-900 shadow-sm" : "border-[#e6e1d8] hover:border-stone-300"}`}
    >
      {children}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{title}</span>
        <span className="block truncate text-[11px] tabular-nums leading-tight text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function Metric({
  icon,
  iconClass,
  label,
  value,
  tone,
  note,
  noteClass,
  series,
  color,
  fromZero = false,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  tone: string;
  note: string | null;
  noteClass: string;
  series: { label: string; value: number }[];
  color: string;
  fromZero?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span className={`grid size-7 place-items-center rounded-lg ${iconClass}`}>{icon}</span>
        {label}
      </div>
      <p className={`mt-3 text-[22px] font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      {note ? <p className={`mt-1 text-xs font-medium ${noteClass}`}>{note}</p> : <p className="mt-1 text-xs text-transparent">.</p>}
      <AreaChart series={series} color={color} fromZero={fromZero} />
    </article>
  );
}

function totals(rows: Row[]) {
  let inflows = 0;
  let outflows = 0;
  for (const row of rows) {
    if (row.amountCents > 0) inflows += row.amountCents;
    else if (row.amountCents < 0) outflows += Math.abs(row.amountCents);
  }
  return {
    todos: rows.length,
    sinCategoria: rows.filter((row) => row.accountingState === "Uncategorized").length,
    sinComprobante: rows.filter((row) => row.documentState === "Missing").length,
    porConciliar: rows.filter((row) => row.reconciliationState === "Unreconciled").length,
    porRevisar: rows.filter((row) => row.reviewState === "NeedsReview").length,
    aprobados: rows.filter((row) => row.reviewState === "Approved").length,
    inflows,
    outflows,
  };
}

function matches(row: Row, filter: string, needle: string) {
  if (needle) {
    const amount = (Math.abs(row.amountCents) / 100).toFixed(2);
    const hit = row.merchant.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle) || amount.includes(needle);
    if (!hit) return false;
  }
  if (filter === "sin-categoria") return row.accountingState === "Uncategorized";
  if (filter === "sin-comprobante") return row.documentState === "Missing";
  if (filter === "por-conciliar") return row.reconciliationState === "Unreconciled";
  if (filter === "por-revisar") return row.reviewState === "NeedsReview";
  if (filter === "aprobados") return row.reviewState === "Approved";
  return true;
}

function seriesFor(rows: Row[], start: string, end: string, availableCents: number) {
  const days = eachDay(start, end);
  const byDay = new Map<string, { inflow: number; outflow: number; net: number }>();
  for (const row of rows) {
    const bucket = byDay.get(row.postedOn) ?? { inflow: 0, outflow: 0, net: 0 };
    if (row.amountCents > 0) bucket.inflow += row.amountCents;
    else if (row.amountCents < 0) bucket.outflow += Math.abs(row.amountCents);
    bucket.net += row.amountCents;
    byDay.set(row.postedOn, bucket);
  }
  const net = days.reduce((sum, day) => sum + (byDay.get(day)?.net ?? 0), 0);
  let running = availableCents - net;
  let cumIn = 0;
  let cumOut = 0;
  const points = (days.length ? days : [end]).map((day) => {
    const bucket = byDay.get(day);
    cumIn += bucket?.inflow ?? 0;
    cumOut += bucket?.outflow ?? 0;
    running += bucket?.net ?? 0;
    return { day, label: shortDay(day), inflows: cumIn, outflows: cumOut, balance: running };
  });
  return {
    inflows: points.map((point) => ({ label: point.label, value: point.inflows })),
    outflows: points.map((point) => ({ label: point.label, value: point.outflows })),
    balance: points.map((point) => ({ label: point.label, value: point.balance })),
  };
}

function sumSigned(rows: Row[], start: string, end: string, kind: "in" | "out", span: Span) {
  const length = eachDay(start, end).length || 1;
  const previousWindow = span === "30" ? monthBounds(addDays(start, -1)) : { start: addDays(addDays(start, -1), -(length - 1)), end: addDays(start, -1) };
  let previous = 0;
  let early = 0;
  let late = 0;
  const mid = addDays(start, Math.floor(length / 2));
  for (const row of rows) {
    const amount = kind === "in" ? (row.amountCents > 0 ? row.amountCents : 0) : row.amountCents < 0 ? Math.abs(row.amountCents) : 0;
    if (!amount) continue;
    if (row.postedOn >= previousWindow.start && row.postedOn <= previousWindow.end) previous += amount;
    else if (row.postedOn >= start && row.postedOn < mid) early += amount;
    else if (row.postedOn >= mid && row.postedOn <= end) late += amount;
  }
  if (previous > 0) return { currentBase: previous, label: span === "30" ? "vs. mes anterior" : "vs. periodo anterior" };
  if (early > 0) return { currentBase: early, compare: late, label: "vs. la primera mitad" };
  return null;
}

function deltaLabel(current: number, prior: { currentBase: number; compare?: number; label: string } | null) {
  if (!prior || prior.currentBase <= 0) return null;
  const next = prior.compare ?? current;
  const pct = Math.round(((next - prior.currentBase) / prior.currentBase) * 100);
  if (!Number.isFinite(pct) || pct === 0) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% ${prior.label}`;
}

function latestDay(rows: Row[]) {
  return rows.reduce((max, row) => (row.postedOn > max ? row.postedOn : max), rows[0]?.postedOn || "2026-10-31");
}

function rangeFor(end: string, span: Span, custom: { start: string; end: string } | null) {
  if (span === "custom" && custom) return custom;
  const month = monthBounds(end);
  if (span === "7") return { start: addDays(end, -6), end };
  if (span === "90") return { start: shiftMonth(month.start, -2), end: month.end };
  if (span === "year") return { start: `${end.slice(0, 4)}-01-01`, end: month.end };
  return month;
}

function monthBounds(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

function shiftMonth(iso: string, delta: number) {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1, 12)).toISOString().slice(0, 10);
}

function eachDay(start: string, end: string) {
  const days: string[] = [];
  const first = Date.parse(`${start}T12:00:00.000Z`);
  const last = Date.parse(`${end}T12:00:00.000Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return days;
  for (let cursor = first; cursor <= last && days.length < 400; cursor += 86_400_000) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

function addDays(iso: string, days: number) {
  const value = Date.parse(`${iso}T12:00:00.000Z`);
  if (!Number.isFinite(value)) return iso;
  return new Date(value + days * 86_400_000).toISOString().slice(0, 10);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function shortDay(iso: string) {
  const [, month, day] = iso.split("-");
  const index = Number(month) - 1;
  return `${Number(day)} ${MONTHS[index] ?? ""}`.trim();
}

function periodTitle(start: string, end: string, span: Span) {
  if (span === "year") return end.slice(0, 4);
  if (start.slice(0, 7) === end.slice(0, 7)) return monthYear(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${monthName(start)} – ${monthName(end)} ${end.slice(0, 4)}`;
  return `${monthYear(start)} – ${monthYear(end)}`;
}

function monthYear(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month) return iso;
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return label.replace(" de ", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function monthName(iso: string) {
  const month = Number(iso.split("-")[1]);
  const label = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1, 12)));
  return label.replace(".", "");
}

function bankAccent(institution: string) {
  const name = institution.toLowerCase();
  if (name.includes("amex") || name.includes("american express")) return "#016FD0";
  if (name.includes("america")) return "#C41230";
  if (name.includes("chase")) return "#0B5CAB";
  if (name.includes("wells")) return "#D71E28";
  return "#5B21B6";
}

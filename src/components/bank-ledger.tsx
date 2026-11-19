"use client";

import { LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sparkline } from "@/components/charts";
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
  const selected = accounts.find((account) => account.id === accountId) ?? null;
  const ofAccount = accountId ? rows.filter((row) => row.accountId === accountId) : rows;
  const counts = totals(ofAccount);
  const needle = query.trim().toLowerCase();
  const visible = ofAccount.filter((row) => matches(row, filter, needle));
  const spotlight = duplicate ? (DUPLICATE_IDS as readonly string[]) : missing ? MISSING_IDS : found;
  const ordered = spotlight.length
    ? [...visible.filter((row) => spotlight.includes(row.id)), ...visible.filter((row) => !spotlight.includes(row.id))]
    : visible;
  const ready = ofAccount.filter((row) => MISSING_IDS.includes(row.id) && row.documentState === "Linked").length;
  const allAvailable = accounts.reduce((sum, account) => sum + account.availableBalanceCents, 0);
  const availableCents = selected ? selected.availableBalanceCents : allAvailable;
  const lines = trend(ofAccount, availableCents);
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
    <section className="min-w-0 rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs text-slate-500">{companyName}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bancos</h1>
            <p className="text-sm text-slate-500">{selected ? `${selected.institution} ····${selected.mask}` : periodOf(ofAccount) || "Todos los bancos, por fecha"}</p>
          </div>
          {selected && ofAccount.some((row) => row.reconciliationState !== "Reconciled") ? (
            <Link
              href={`/cuentas?${new URLSearchParams({ cuenta: selected.id, paso: "conciliar", ...(withChat ? { con: "chat", ...(flujo ? { flujo } : {}) } : {}) }).toString()}`}
              className="text-sm font-medium text-primary"
            >
              Conciliar con el banco
            </Link>
          ) : null}
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-3">
          <div data-testid="bank-totals" className="grid grid-cols-3 gap-2">
            <Total label="Ingresos" value={formatUsd(counts.inflows)} tone="text-emerald-600" points={lines.inflows} color="#059669" fill />
            <Total label="Gastos" value={formatUsd(counts.outflows)} tone="text-rose-600" points={lines.outflows} color="#e11d48" fill />
            <Total
              label="Disponible"
              value={formatUsd(availableCents)}
              tone="text-slate-900"
              points={lines.balance}
              color="#334155"
              hint={selected ? "Esta cuenta" : `Las ${accounts.length} cuentas`}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
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
                <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><LayoutGrid className="size-3.5" /></span>
              </AccountTab>
              {accounts.map((account) => {
                const active = account.id === accountId;
                const accent = bankAccent(account.institution);
                return (
                  <AccountTab
                    key={account.id}
                    active={active}
                    title={account.institution}
                    detail={`····${account.mask} · ${formatUsd(account.availableBalanceCents)}`}
                    wide
                    onSelect={() => {
                      setAccountId(account.id);
                      remember({ cuenta: account.id });
                    }}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white" style={{ backgroundColor: accent }}>{accountInitials(account.institution)}</span>
                  </AccountTab>
                );
              })}
            </nav>
            <Link href="/cuentas/conectar" data-testid="add-account" className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              <Plus className="mr-1 inline size-3.5" /> Agregar
            </Link>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/movimientos?vista=enfoque" className="rounded-full border border-border px-3 py-1.5 text-xs text-slate-600">Modo enfoque</Link>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800">Vista detallada</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-4 py-3">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              remember({ filtro: key });
            }}
            className={filter === key ? "rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900" : "rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"}
          >
            {label}
            <span className="ml-1 text-slate-400">{countFor[key]}</span>
          </button>
        ))}
      </div>
      <form
        className="px-4 pb-3"
        onSubmit={(event) => {
          event.preventDefault();
          remember({ q: query });
        }}
      >
        <Input
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            remember({ q: event.target.value });
          }}
          placeholder="Buscar movimiento..."
        />
      </form>
      {notice === "factura" ? <p data-testid="invoice-reconciled" className="px-4 pb-3 text-sm text-emerald-800">La factura quedó conciliada con el movimiento del banco.</p> : null}
      {notice === "lote" ? <p data-testid="batch-reconciled" className="px-4 pb-3 text-sm text-emerald-800">El lote quedó conciliado con los movimientos del banco.</p> : null}
      {duplicate ? <DuplicatePanel decision={decision} /> : null}
      {missing ? <MissingPanel ready={ready} /> : null}
      {error ? <div className="px-4 pb-3"><StateView variant="error" title={error} testId="server-error" /></div> : null}
      {ordered.length === 0 ? (
        <div className="px-4 pb-4">
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
      className={`flex h-12 shrink-0 items-center gap-2 rounded-xl border bg-white px-2.5 text-left ${wide ? "w-[188px]" : ""} ${active ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
    >
      {children}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{title}</span>
        <span className="block truncate text-[11px] tabular-nums leading-tight text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

function Total({ label, value, tone, points, color, hint, fill = false }: { label: string; value: string; tone: string; points: number[]; color: string; hint?: string; fill?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
      <Sparkline points={points} color={color} fill={fill} />
    </div>
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

function trend(rows: Row[], availableCents: number) {
  const byDay = new Map<string, { inflow: number; outflow: number; net: number }>();
  for (const row of rows) {
    const day = row.postedOn || "0000-01-01";
    const bucket = byDay.get(day) ?? { inflow: 0, outflow: 0, net: 0 };
    if (row.amountCents > 0) bucket.inflow += row.amountCents;
    else if (row.amountCents < 0) bucket.outflow += Math.abs(row.amountCents);
    bucket.net += row.amountCents;
    byDay.set(day, bucket);
  }
  const days = [...byDay.keys()].sort();
  const net = days.reduce((sum, day) => sum + (byDay.get(day)?.net ?? 0), 0);
  let running = availableCents - net;
  const balance = days.map((day) => {
    running += byDay.get(day)?.net ?? 0;
    return running;
  });
  return {
    inflows: days.map((day) => byDay.get(day)?.inflow ?? 0),
    outflows: days.map((day) => byDay.get(day)?.outflow ?? 0),
    balance: balance.length ? balance : [availableCents],
  };
}

function periodOf(rows: { postedOn: string }[]) {
  const day = rows.find((row) => row.postedOn)?.postedOn;
  if (!day) return "";
  const [year, month] = day.split("-").map(Number);
  if (!year || !month) return "";
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1, 12))).replace(" de ", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function bankAccent(institution: string) {
  const name = institution.toLowerCase();
  if (name.includes("amex") || name.includes("american express")) return "#016FD0";
  if (name.includes("america")) return "#C41230";
  if (name.includes("chase")) return "#0B5CAB";
  if (name.includes("wells")) return "#D71E28";
  return "#5B21B6";
}

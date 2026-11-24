"use client";

import { Building2, ChevronRight, Landmark, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Sparkline } from "@/components/charts";
import { accountInitials } from "@/lib/accounts";
import { percentLabel } from "@/lib/insights";
import { formatUsd } from "@/lib/money";

type Card = {
  id: string;
  institution: string;
  mask: string;
  kind: string;
  availableBalanceCents: number;
  net: number;
  series: number[];
  origin: string;
  isDemonstration: boolean;
  delta: number | null;
};

const COLORS = ["#7ea3c4", "#8eafc8", "#a9c4da", "#c5d7e6"];

function running(series: number[]) {
  let sum = 0;
  return series.map((value) => (sum += value));
}

function kindLabel(kind: string) {
  return kind === "card" ? "Tarjeta de crédito" : "Cuenta de cheques";
}

function originLabel(card: Card) {
  if (card.origin === "plaid_demo") return "Conectada en demostración";
  if (card.origin === "manual") return "Agregada a mano";
  return card.isDemonstration ? "Guardada en la demostración" : "Saldo guardado";
}

export function AccountsBoard({
  totalCents,
  monthInflows,
  monthOutflows,
  incomeDelta,
  expenseDelta,
  insight,
  cards,
}: {
  totalCents: number;
  monthInflows: number;
  monthOutflows: number;
  incomeDelta: number | null;
  expenseDelta: number | null;
  insight: string;
  cards: Card[];
}) {
  const [tab, setTab] = useState<"cuentas" | "conexiones">("cuentas");
  return (
    <section className="space-y-5">
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-6 top-0 h-24 w-56 rounded-full bg-violet-200/70 blur-2xl" />
        <h1 className="text-3xl font-semibold tracking-tight">Cuentas bancarias</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">Conecta tus bancos y revisa el saldo guardado de cada cuenta.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Landmark className="size-4 text-blue-600" />} label="Saldo total" value={formatUsd(totalCents)} />
        <Metric icon={<span className="text-emerald-600">↑</span>} label="Ingresos (mes)" value={formatUsd(monthInflows)} delta={incomeDelta} good />
        <Metric icon={<span className="text-rose-600">↓</span>} label="Egresos (mes)" value={formatUsd(monthOutflows)} delta={expenseDelta} good={false} />
        <Metric icon={<Building2 className="size-4 text-emerald-600" />} label="Cuentas guardadas" value={String(cards.length)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <button type="button" onClick={() => setTab("cuentas")} className={tab === "cuentas" ? "border-b-2 border-blue-600 pb-1 font-medium text-blue-700" : "pb-1 text-slate-500"}>
            Mis cuentas
          </button>
          <button type="button" onClick={() => setTab("conexiones")} className={tab === "conexiones" ? "border-b-2 border-blue-600 pb-1 font-medium text-blue-700" : "pb-1 text-slate-500"}>
            Todas las conexiones
          </button>
        </div>
        <div className="flex gap-2">
          <Link href="/cuentas" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300">
            <RefreshCw className="size-4" /> Actualizar saldos
          </Link>
          <Link href="/cuentas/conectar" data-testid="add-account" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white">
            <Plus className="size-4" /> Conectar cuenta
          </Link>
        </div>
      </div>

      {cards.length === 0 ? <p className="rounded-2xl border border-border bg-white p-4 text-sm text-slate-500">Esta empresa no tiene cuentas bancarias.</p> : null}

      {tab === "cuentas" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => {
            const negative = card.availableBalanceCents < 0 || card.net < 0;
            const color = negative ? "#ef4444" : COLORS[index % COLORS.length];
            const caption = card.delta === null ? `Neto del mes ${formatUsd(card.net)}` : `${percentLabel(card.delta)} vs. mes anterior`;
            return (
              <Link
                key={card.id}
                href={`/movimientos?cuenta=${card.id}`}
                data-testid={`account-${card.id}`}
                className="rounded-2xl border border-border bg-white p-4 transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-slate-50 text-xs font-semibold text-slate-700">{accountInitials(card.institution)}</span>
                    <span>
                      <span className="block font-semibold">{card.institution}</span>
                      <span className="block text-xs text-slate-500">{kindLabel(card.kind)} ···· {card.mask}</span>
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-slate-300" />
                </div>
                <p data-testid="account-balance" className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{formatUsd(card.availableBalanceCents)}</p>
                <p className={`mt-1 text-xs font-medium ${card.delta === null ? (card.net < 0 ? "text-rose-600" : "text-emerald-600") : card.delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{caption}</p>
                <div className="mt-3">
                  <Sparkline points={running(card.series)} color={color} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {cards.map((card) => (
            <li key={card.id}>
              <Link href={`/movimientos?cuenta=${card.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-medium">{card.institution} ···· {card.mask}</span>
                  <span className="block text-xs text-slate-500">{originLabel(card)}</span>
                </span>
                <span className="text-sm font-medium tabular-nums">{formatUsd(card.availableBalanceCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div data-testid="cuentas-reading" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
        <p className="flex items-start gap-2 text-sm text-slate-700">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-600" />
          <span><span className="font-medium">Insight de Serbell. </span>{insight}</span>
        </p>
        <Link href="/reportes" className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-medium text-violet-700">
          Ver flujo de efectivo →
        </Link>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  good,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  good?: boolean;
}) {
  const up = (delta ?? 0) > 0;
  const color = delta === null || delta === undefined ? "text-slate-400" : good ? (up ? "text-emerald-600" : "text-rose-600") : up ? "text-rose-600" : "text-emerald-600";
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 place-items-center rounded-full bg-slate-50">{icon}</span>
      <span>
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="block text-lg font-semibold tabular-nums">{value}</span>
        {delta !== undefined ? <span className={`block text-xs font-medium ${color}`}>{percentLabel(delta)}</span> : null}
      </span>
    </div>
  );
}

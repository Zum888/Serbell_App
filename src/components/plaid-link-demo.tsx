"use client";

import { ArrowLeft, Check, ChevronRight, Lock, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/money";

type Bank = { name: string; color: string; initials: string };

const BANKS: Bank[] = [
  { name: "Chase", color: "#117aca", initials: "CH" },
  { name: "Bank of America", color: "#e31837", initials: "BA" },
  { name: "Wells Fargo", color: "#d71e28", initials: "WF" },
  { name: "Citibank", color: "#056dae", initials: "CI" },
  { name: "Capital One", color: "#004977", initials: "C1" },
  { name: "American Express", color: "#006fcf", initials: "AX" },
  { name: "U.S. Bank", color: "#0c2074", initials: "US" },
  { name: "PNC", color: "#ef7622", initials: "PN" },
  { name: "TD Bank", color: "#34a853", initials: "TD" },
  { name: "Truist", color: "#2e1a47", initials: "TR" },
  { name: "Regions", color: "#5d9732", initials: "RG" },
  { name: "BBVA", color: "#004481", initials: "BB" },
];

type Offer = { name: string; mask: string; kind: "bank" | "card"; balanceCents: number };

function seed(text: string) {
  let hash = 7;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  return hash;
}

function offersFor(bank: Bank): Offer[] {
  const base = seed(bank.name);
  const mask = (offset: number) => String((base + offset * 1373) % 10_000).padStart(4, "0");
  const offers: Offer[] = [
    { name: "Business Checking", mask: mask(1), kind: "bank", balanceCents: 1_250_000 + (base % 900) * 1_000 },
    { name: "Business Savings", mask: mask(2), kind: "bank", balanceCents: 3_400_000 + (base % 500) * 1_500 },
  ];
  if (bank.name !== "PNC" && bank.name !== "TD Bank") {
    offers.push({ name: "Business Credit Card", mask: mask(3), kind: "card", balanceCents: 180_000 + (base % 300) * 500 });
  }
  return offers;
}

type Step = "intro" | "banks" | "login" | "accounts" | "done";

export function PlaidLinkDemo({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [picked, setPicked] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);

  const banks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? BANKS.filter((item) => item.name.toLowerCase().includes(needle)) : BANKS;
  }, [query]);
  const offers = bank ? offersFor(bank) : [];

  async function connect() {
    if (!bank) return;
    const chosen = offers.filter((offer) => picked[offer.mask]);
    if (chosen.length === 0) {
      setError("Elige al menos una cuenta.");
      return;
    }
    setBusy(true);
    setError(null);
    const ids: string[] = [];
    try {
      for (const offer of chosen) {
        const response = await fetch("/api/accounts/plaid-demo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ institution: bank.name, name: offer.name, mask: offer.mask, kind: offer.kind, balanceCents: offer.balanceCents }),
        });
        const body = (await response.json()) as { id?: string; error?: string };
        if (!response.ok || !body.id) throw new Error(body.error || "No se pudo conectar la cuenta.");
        ids.push(body.id);
      }
      setCreated(ids);
      setStep("done");
      router.refresh();
    } catch (cause) {
      if (ids.length) setCreated(ids);
      setError(cause instanceof Error ? cause.message : "No se pudo conectar la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  const back: Partial<Record<Step, Step>> = { banks: "intro", login: "banks", accounts: "login" };

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-white shadow-xl shadow-slate-900/5" data-testid="plaid-demo">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {back[step] ? (
            <button type="button" onClick={() => setStep(back[step] as Step)} aria-label="Atrás" className="rounded-md p-1 hover:bg-slate-100">
              <ArrowLeft className="size-4" />
            </button>
          ) : <span className="size-6" />}
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-900">
            <span className="grid size-5 place-items-center rounded bg-slate-900 text-[9px] font-bold text-white">P</span>
            PLAID <span className="font-normal text-amber-700">· demostración</span>
          </p>
          <Link href="/movimientos" aria-label="Cerrar" className="rounded-md p-1 hover:bg-slate-100"><X className="size-4" /></Link>
        </div>

        {step === "intro" ? (
          <div className="p-6">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-900 text-lg font-bold text-white">S</div>
            <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">Serbell usa Plaid para conectar tu banco</h1>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Conexión cifrada. Serbell nunca ve tu contraseña.</li>
              <li className="flex gap-3"><Lock className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Solo lectura: saldos y movimientos de {companyName}.</li>
            </ul>
            <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Modo demostración: no se conecta a ningún banco real. Escribe cualquier usuario y contraseña.
            </p>
            <button type="button" onClick={() => setStep("banks")} data-testid="plaid-continue" className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">
              Continuar
            </button>
          </div>
        ) : null}

        {step === "banks" ? (
          <div className="p-4">
            <h1 className="text-lg font-semibold tracking-tight">Elige tu banco</h1>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar banco"
                aria-label="Buscar banco"
                className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm"
              />
            </div>
            <div className="mt-3 grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto">
              {banks.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  data-testid="plaid-bank"
                  onClick={() => {
                    setBank(item);
                    setPicked({});
                    setUser("");
                    setPassword("");
                    setError(null);
                    setStep("login");
                  }}
                  className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 text-left text-sm hover:border-slate-400"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: item.color }}>{item.initials}</span>
                  <span className="truncate font-medium">{item.name}</span>
                </button>
              ))}
              {banks.length === 0 ? <p className="col-span-2 py-6 text-center text-sm text-slate-500">No encontramos ese banco.</p> : null}
            </div>
          </div>
        ) : null}

        {step === "login" && bank ? (
          <form
            className="p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!user.trim() || !password.trim()) {
                setError("Escribe un usuario y una contraseña (cualquiera, es demostración).");
                return;
              }
              setError(null);
              setPicked(Object.fromEntries(offers.map((offer) => [offer.mask, true as const])));
              setStep("accounts");
            }}
          >
            <span className="mx-auto grid size-12 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: bank.color }}>{bank.initials}</span>
            <h1 className="mt-3 text-center text-lg font-semibold">Entra a {bank.name}</h1>
            <label className="mt-4 block text-xs text-slate-500">
              Usuario
              <input value={user} onChange={(event) => setUser(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" autoComplete="off" />
            </label>
            <label className="mt-3 block text-xs text-slate-500">
              Contraseña
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-sm" autoComplete="off" />
            </label>
            {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
            <button type="submit" data-testid="plaid-login" className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">Entrar</button>
          </form>
        ) : null}

        {step === "accounts" && bank ? (
          <div className="p-4">
            <h1 className="text-lg font-semibold tracking-tight">¿Qué cuentas quieres conectar?</h1>
            <p className="text-sm text-slate-500">{bank.name} · se agregan a {companyName}</p>
            <ul className="mt-3 space-y-2">
              {offers.map((offer) => {
                const on = Boolean(picked[offer.mask]);
                return (
                  <li key={offer.mask}>
                    <button
                      type="button"
                      onClick={() => setPicked((state) => {
                        const nextState = { ...state };
                        if (nextState[offer.mask]) delete nextState[offer.mask];
                        else nextState[offer.mask] = true;
                        return nextState;
                      })}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-slate-900 bg-slate-50" : "border-border"}`}
                    >
                      <span className={`grid size-5 place-items-center rounded-md border ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>
                        {on ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{offer.name}</span>
                        <span className="text-xs text-slate-500">{offer.kind === "card" ? "Crédito" : "Corriente"} ····{offer.mask}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatUsd(offer.balanceCents)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
            <button type="button" disabled={busy} onClick={() => void connect()} data-testid="plaid-connect" className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Conectando…" : "Conectar"}
            </button>
          </div>
        ) : null}

        {step === "done" && bank ? (
          <div className="p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-7" /></span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">¡Listo! {bank.name} quedó conectado</h1>
            <p className="mt-1 text-sm text-slate-500">
              {created.length === 1 ? "Se agregó 1 cuenta" : `Se agregaron ${created.length} cuentas`} de demostración. Aún no trae movimientos.
            </p>
            <div className="mt-5 grid gap-2">
              <Link href={`/movimientos?cuenta=${created[0]}`} className="flex items-center justify-center gap-1 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">
                Ver la cuenta <ChevronRight className="size-4" />
              </Link>
              <button type="button" onClick={() => { setBank(null); setQuery(""); setStep("banks"); }} className="rounded-xl border border-border py-3 text-sm font-medium">
                Conectar otro banco
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

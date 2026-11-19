"use client";

import { Check, Loader2, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MISSING_HREF, MISSING_RECEIPTS } from "@/lib/missing-receipts";

export function MissingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const matched = Math.min(MISSING_RECEIPTS.length, Math.max(0, step - 4));

  useEffect(() => {
    if (step >= 8 || error) return;
    const delay = step >= 1 && step <= 7 ? 480 : 700;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step, error]);

  useEffect(() => {
    if (step !== 8 || error) return;
    let cancel = false;
    void (async () => {
      const response = await fetch("/api/transactions/missing-receipts", { method: "POST", headers: { accept: "application/json" } });
      const body = (await response.json()) as { error?: string };
      if (cancel) return;
      if (!response.ok) {
        setError(body.error || "No se pudieron adjuntar los tickets.");
        return;
      }
      router.push(MISSING_HREF);
    })();
    return () => {
      cancel = true;
    };
  }, [router, step, error]);

  return (
    <div className="space-y-6" data-testid="missing-flow">
      <p className="ml-auto w-fit max-w-[80%] rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-6 text-slate-800 shadow-sm">
        Faltan comprobantes.
      </p>

      {step >= 1 ? (
        <p className="max-w-[40rem] text-[15px] leading-7 text-slate-800">
          {step < 4
            ? "Hay tres movimientos sin ticket: Love's, Comfort Inn y Flying J."
            : matched < 3
              ? "Llegaron los tres tickets. Los comparo con el banco."
              : "Los tres cierran. Los dejo listos para el contador."}
        </p>
      ) : null}

      {step >= 1 && step < 4 ? (
        <ul className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="missing-list">
          {MISSING_RECEIPTS.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <span>
                <span className="block text-sm font-medium">{item.merchant}</span>
                <span className="block text-xs text-slate-500">{item.date}</span>
              </span>
              <span className="text-sm tabular-nums">{item.amount}</span>
              {index < step ? <span className="text-xs text-amber-700">Sin ticket</span> : <Loader2 className="size-4 animate-spin text-slate-300" />}
            </li>
          ))}
        </ul>
      ) : null}

      {step >= 4 ? (
        <ul className="max-w-md overflow-hidden rounded-2xl bg-white shadow-sm" data-testid="missing-match">
          {MISSING_RECEIPTS.map((item, index) => {
            const done = index < matched;
            const active = index === matched && step < 8;
            return (
              <li key={item.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${done ? "bg-emerald-50" : ""}`}>
                <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <Receipt className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.fileName}</span>
                  <span className="block text-xs text-slate-500">{item.merchant} · {item.amount}</span>
                </span>
                {done ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white">
                    <Check className="size-3" /> Mismo monto
                  </span>
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-slate-400" />
                ) : (
                  <span className="text-xs text-slate-300">En espera</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-rose-700" data-testid="missing-error">{error}</p> : null}
    </div>
  );
}

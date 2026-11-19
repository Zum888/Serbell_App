"use client";

import { useSyncExternalStore } from "react";

export const MONEY_KEY = "serbell-money";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-money"] });
  return () => observer.disconnect();
}

function readColored() {
  return document.documentElement.dataset.money !== "plain";
}

export function MoneyToggle() {
  const colored = useSyncExternalStore(subscribe, readColored, () => true);

  function setColored(next: boolean) {
    if (next === colored) return;
    document.documentElement.dataset.money = next ? "color" : "plain";
    try {
      localStorage.setItem(MONEY_KEY, next ? "color" : "plain");
    } catch {}
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span>Importes</span>
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
        <button
          type="button"
          aria-pressed={!colored}
          onClick={() => setColored(false)}
          className={`rounded-md px-2.5 py-1 ${colored ? "text-slate-500" : "bg-white font-medium text-slate-800 shadow-sm"}`}
        >
          Neutro
        </button>
        <button
          type="button"
          data-testid="money-toggle"
          aria-pressed={colored}
          onClick={() => setColored(true)}
          className={`rounded-md px-2.5 py-1 ${colored ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500"}`}
        >
          Verde / rojo
        </button>
      </div>
    </div>
  );
}

"use client";

import { Palette } from "lucide-react";
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

  function flip() {
    const next = !colored;
    document.documentElement.dataset.money = next ? "color" : "plain";
    try {
      localStorage.setItem(MONEY_KEY, next ? "color" : "plain");
    } catch {}
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={colored}
      onClick={flip}
      data-testid="money-toggle"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-300"
    >
      <Palette className="size-3.5" />
      Colores
      <span className={`relative h-4 w-7 rounded-full transition ${colored ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${colored ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

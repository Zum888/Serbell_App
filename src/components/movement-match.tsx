"use client";

import { Building2, Calendar, Check, ExternalLink, Sparkles, Tag, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCentsPlain } from "@/lib/money";

type Group = { id: string; name: string; children?: { id: string; name: string }[] };

export function MovementMatch({
  detail,
  categories,
  closeHref,
  next,
}: {
  detail: {
    id: string;
    merchant: string;
    amountCents: number;
    institution: string;
    productName: string;
    mask: string;
    sealed: boolean;
    categoryId: string;
    subcategoryId: string;
    match: {
      linked: boolean;
      documentId: string;
      fileName: string;
      postedDay: string;
      checks: { id: string; label: string }[];
      suggested: boolean;
    };
  };
  categories: Group[];
  closeHref: string;
  next: string;
}) {
  const groups = categories.filter((group) => (group.children?.length ?? 0) > 0);
  const initialGroup = groups.find((group) => group.id === detail.categoryId) ?? groups.find((group) => group.children?.some((child) => child.id === detail.subcategoryId)) ?? groups[0];
  const [categoryId, setCategoryId] = useState(initialGroup?.id ?? "");
  const children = groups.find((group) => group.id === categoryId)?.children ?? [];
  const [subcategoryId, setSubcategoryId] = useState(
    children.some((child) => child.id === detail.subcategoryId) ? detail.subcategoryId : children[0]?.id ?? "",
  );
  const match = detail.match;
  const amount = `${detail.amountCents < 0 ? "-" : ""}$${formatCentsPlain(detail.amountCents)}`;

  function pickCategory(id: string) {
    setCategoryId(id);
    const nextChild = groups.find((group) => group.id === id)?.children?.[0];
    setSubcategoryId(nextChild?.id ?? "");
  }

  return (
    <aside data-testid="movement-match" className="rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Detalle del movimiento</p>
        <Link href={closeHref} aria-label="Cerrar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X className="size-4" />
        </Link>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{amount}</p>
      <h2 className="text-xl font-semibold">{detail.merchant}</h2>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <p className="inline-flex items-center gap-1.5">
          <Building2 className="size-3.5 text-slate-400" />
          {detail.institution} {detail.productName} ··· {detail.mask}
        </p>
        <p className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5 text-slate-400" />
          {longDay(match.postedDay)}
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3">
        <p className="flex items-center gap-2 font-medium text-violet-950">
          <Sparkles className="size-4 text-violet-500" />
          Encontré tu comprobante
        </p>
        <p className="mt-1 text-sm text-violet-900/80">Serbell detectó una coincidencia y validó el importe, la fecha y el proveedor.</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <ReceiptSketch merchant={detail.merchant} day={match.postedDay} amountCents={detail.amountCents} mask={detail.mask} fileName={match.fileName} />
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{match.fileName}</p>
            <Link href={`/comprobantes?recibo=${match.documentId}`} aria-label="Ver en comprobantes" className="text-slate-400 hover:text-slate-700">
              <ExternalLink className="size-4" />
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {match.checks.map((check) => (
              <li key={check.id} data-testid="match-check" className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Clasificación</h3>
        {match.suggested ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
            <Sparkles className="size-3" /> Sugerida por Serbell
          </span>
        ) : null}
      </div>
      <label className="mt-3 block text-sm text-slate-600">
        Categoría
        <span className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3">
          <Tag className="size-4 text-slate-400" />
          <select
            aria-label="Categoría"
            value={categoryId}
            disabled={detail.sealed || groups.length === 0}
            onChange={(event) => pickCategory(event.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none disabled:text-slate-500"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </span>
      </label>
      <label className="mt-3 block text-sm text-slate-600">
        Subcategoría
        <span className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3">
          <Tag className="size-4 text-slate-400" />
          <select
            aria-label="Subcategoría"
            value={subcategoryId}
            disabled={detail.sealed || children.length === 0}
            onChange={(event) => setSubcategoryId(event.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none disabled:text-slate-500"
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.name}</option>
            ))}
          </select>
        </span>
      </label>

      {match.linked ? (
        <p className="mt-4 text-sm text-emerald-800">Vinculado. El comprobante ya está en Comprobantes.</p>
      ) : (
        <form action={`/api/documents/${match.documentId}/link`} method="post" className="mt-4">
          <input type="hidden" name="transactionId" value={detail.id} />
          <input type="hidden" name="subcategoryId" value={subcategoryId} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" data-testid="confirm-link" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            <Check className="size-4" /> Confirmar y vincular
          </button>
        </form>
      )}
    </aside>
  );
}

function ReceiptSketch({
  merchant,
  day,
  amountCents,
  mask,
  fileName,
}: {
  merchant: string;
  day: string;
  amountCents: number;
  mask: string;
  fileName: string;
}) {
  const total = Math.abs(amountCents);
  const tax = Math.round(total * 0.072);
  const net = total - tax;
  const number = fileName.replace(/\D/g, "").slice(-5) || "01842";
  return (
    <div className="rounded-xl border border-stone-200 bg-[#fffdf8] p-3 text-[10px] leading-tight text-stone-800 shadow-sm" aria-hidden="true">
      <div className="mx-auto grid size-8 place-items-center rounded-md bg-orange-600 text-[9px] font-bold text-white">{initials(merchant)}</div>
      <p className="mt-2 text-center text-stone-500">{formatDay(day)}</p>
      <p className="text-center">Receipt #{number}</p>
      <div className="mt-2 space-y-1 border-t border-dashed border-stone-300 pt-2">
        <Row label="Cargo" value={formatCentsPlain(net)} />
        <Row label="Tax" value={formatCentsPlain(tax)} />
        <div className="flex justify-between border-t border-stone-300 pt-1 font-semibold">
          <span>TOTAL</span>
          <span>${formatCentsPlain(total)}</span>
        </div>
      </div>
      <p className="mt-2 text-center tracking-wide">VISA **** {mask}</p>
      <div className="mt-2 flex h-6 items-end justify-center gap-px">
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} className="bg-stone-800" style={{ width: index % 3 === 0 ? 2 : 1, height: 8 + (index % 5) * 3 }} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>${value}</span>
    </div>
  );
}

function initials(merchant: string) {
  const parts = merchant.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "TK";
}

function formatDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, date, 12))).replace(/\./g, "");
}

function longDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, date, 12)));
}

import { LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountsBoard } from "@/components/accounts-board";
import { BankStep } from "@/components/bank-step";
import { MoneyToggle } from "@/components/money-toggle";
import { StateView } from "@/components/state-view";
import { accountInitials, movementRunningCents } from "@/lib/accounts";
import { change } from "@/lib/insights";
import { RECONCILIATION_LABEL } from "@/lib/labels";
import { LOTE, LOTE_ACCOUNT, loteItem, loteNextHref } from "@/lib/lote";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { monthHistory } from "@/server/planning";
import { accountBreakdowns, companyReport } from "@/server/queries";

function kindLabel(kind: string) {
  return kind === "card" ? "Crédito" : "Corriente";
}

function autoMatchFor(params: { factura?: string; lote?: string; actual?: string }, accountId: string, transactionId: string) {
  if (params.factura === "1" && transactionId === "tx_qpl_fs_20394") {
    return {
      file: "Factura_FleetSmarts.pdf",
      nextHref: `/cuentas?cuenta=${accountId}&factura=lista`,
      note: "Lo concilio.",
    };
  }
  if (params.lote === "1" && accountId === LOTE_ACCOUNT) {
    const item = loteItem(params.actual);
    if (item && item.id === transactionId) {
      const index = LOTE.findIndex((row) => row.id === item.id) + 1;
      return {
        file: item.fileName,
        nextHref: loteNextHref(item.id),
        note: index === 4 ? "Cierro el lote." : `Van ${index} de 4.`,
      };
    }
  }
  return null;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; paso?: string; actual?: string; error?: string; factura?: string; lote?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cuentas." />;
  const database = await db();
  const [accounts, report, history] = await Promise.all([
    accountBreakdowns(database, session.actor, session.companyId),
    companyReport(database, session.actor, session.companyId),
    monthHistory(database, session.actor, session.companyId),
  ]);
  const selected = accounts.find((account) => account.id === params.cuenta) ?? null;
  if (params.cuenta && !selected) {
    return <StateView variant="error" title="Esa cuenta no está en esta empresa." testId="server-error" />;
  }
  if (selected && params.paso === "conciliar") {
    if (params.lote === "1" && selected.id === LOTE_ACCOUNT) {
      const item = loteItem(params.actual);
      const movement = item ? selected.movements.find((row) => row.id === item.id) : null;
      if (item && (!movement || movement.reconciliationState === "Reconciled" || movement.sealed)) {
        redirect(loteNextHref(item.id));
      }
    }
    const open = [...selected.movements]
      .filter((movement) => movement.reconciliationState !== "Reconciled")
      .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
    const current = open.find((movement) => movement.id === params.actual) ?? open[0] ?? null;
    if (!current) {
      return (
        <section>
          <Link href={`/cuentas?cuenta=${selected.id}`} className="text-sm text-primary">Volver a la cuenta</Link>
          <div className="mt-4">
            <StateView variant="empty" title="Esta cuenta no tiene movimientos sin conciliar." />
          </div>
        </section>
      );
    }
    const index = open.findIndex((movement) => movement.id === current.id);
    const next = open[index + 1] ?? open.find((movement) => movement.id !== current.id) ?? null;
    const running = movementRunningCents(selected.movements, current.id) ?? 0;
    const done = selected.movements.length === 0 ? 0 : Math.round((selected.reconciledCount / selected.movements.length) * 100);
    return (
      <BankStep
        error={params.error}
        autoMatch={autoMatchFor(params, selected.id, current.id)}
        data={{
          accountHref: `/cuentas?cuenta=${selected.id}`,
          progress: `${selected.unreconciledCount} de ${selected.movements.length} sin conciliar`,
          donePercent: done,
          hints: "Enter concilia · S omite · Esc vuelve a la cuenta",
          sealed: current.sealed,
          merchant: current.merchant,
          postedOn: current.postedOn,
          description: current.description,
          amountCents: current.amountCents,
          storedBalanceCents: selected.availableBalanceCents,
          runningCents: running,
          categoryLabel: current.categoryLabel,
          documentName: current.documentName,
          documentState: current.documentState,
          reviewState: current.reviewState,
          accountingState: current.accountingState,
          transactionId: current.id,
          nextSkip: next ? `/cuentas?cuenta=${selected.id}&paso=conciliar&actual=${next.id}` : null,
        }}
      />
    );
  }
  if (selected) {
    return (
      <section className="space-y-4">
        <nav aria-label="Cambiar de cuenta" data-testid="account-switcher" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link href="/cuentas" className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-300">
            <LayoutGrid className="size-4" /> Todas
          </Link>
          {accounts.map((account) => {
            const active = account.id === selected.id;
            return (
              <Link
                key={account.id}
                href={`/cuentas?cuenta=${account.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-border bg-white hover:border-slate-300"}`}
              >
                <span className={`grid size-7 place-items-center rounded-lg text-[10px] font-semibold ${active ? "bg-white/15" : "bg-slate-100 text-slate-700"}`}>
                  {accountInitials(account.institution)}
                </span>
                <span>
                  <span className="block text-xs font-medium leading-tight">{account.institution} ····{account.mask}</span>
                  <span className={`block text-[11px] tabular-nums leading-tight ${active ? "text-white/70" : "text-slate-500"}`}>{formatUsd(account.availableBalanceCents)}</span>
                </span>
              </Link>
            );
          })}
          <Link href="/cuentas/conectar" className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400">
            <Plus className="size-4" /> Agregar
          </Link>
        </nav>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{selected.institution}</p>
              <h1 className="text-2xl font-semibold tracking-tight">{selected.productName}</h1>
              <p className="text-sm text-slate-600">{kindLabel(selected.kind)} · ····{selected.mask} · USD</p>
            </div>
            {selected.unreconciledCount > 0 ? (
              <Link href={`/cuentas?cuenta=${selected.id}&paso=conciliar`} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
                Conciliar con el banco
              </Link>
            ) : null}
          </div>
          {selected.origin === "plaid_demo" ? (
            <p className="mt-2 text-sm text-emerald-700">Conectada con Plaid (demostración). Todavía no trae movimientos.</p>
          ) : selected.origin === "manual" ? (
            <p className="mt-2 text-sm text-amber-700">Cuenta manual. No está conectada a un banco.</p>
          ) : selected.isDemonstration ? (
            <p className="mt-2 text-sm text-amber-700">Demostración. El saldo es el guardado en esta cuenta.</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">El saldo disponible es el guardado en esta cuenta.</p>
          )}
        </div>
        {params.factura === "lista" ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="invoice-reconciled">
            La factura quedó conciliada con el movimiento del banco.
          </p>
        ) : null}
        {params.lote === "lista" ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="lote-reconciled">
            El lote quedó conciliado con los movimientos del banco.
          </p>
        ) : null}
        {params.error ? <p className="text-sm text-red-700" data-testid="server-error">{params.error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Saldo disponible</p>
            <p data-testid="account-balance" className="mt-1 text-2xl font-semibold tracking-tight">{formatUsd(selected.availableBalanceCents)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Entradas</p>
            <p className="money-in mt-1 text-lg font-semibold">{formatUsd(selected.inflows)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Salidas</p>
            <p className="money-out mt-1 text-lg font-semibold">{formatUsd(selected.outflows)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Conciliados</p>
            <p className="mt-1 text-lg font-semibold" data-testid="account-reconciled">{selected.reconciledCount} de {selected.movements.length}</p>
          </article>
        </div>
        <div className="flex justify-end"><MoneyToggle /></div>
        {selected.movements.length === 0 ? (
          <StateView variant="empty" title="Esta cuenta no tiene movimientos." description="El saldo inicial quedó guardado. No se inventaron movimientos." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Movimiento</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Conciliación bancaria</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {selected.movements.map((movement) => (
                  <tr key={movement.id} data-testid="account-movement" className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{movement.postedOn}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{movement.merchant}</p>
                      <p className="text-xs text-slate-500">{movement.description}</p>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${movement.amountCents < 0 ? "money-out" : "money-in"}`}>{formatUsd(movement.amountCents)}</td>
                    <td className="px-4 py-3" data-testid="bank-recon">{RECONCILIATION_LABEL[movement.reconciliationState] ?? movement.reconciliationState}</td>
                    <td className="px-4 py-3">
                      {movement.reconciliationState === "Reconciled" && !movement.sealed ? (
                        <form action={`/api/transactions/${movement.id}/bank`} method="post">
                          <input type="hidden" name="action" value="undo" />
                          <input type="hidden" name="next" value={`/cuentas?cuenta=${selected.id}`} />
                          <button type="submit" data-testid={`undo-${movement.id}`} className="text-sm font-medium text-primary">Deshacer conciliación</button>
                        </form>
                      ) : movement.reconciliationState !== "Reconciled" ? (
                        <Link href={`/cuentas?cuenta=${selected.id}&paso=conciliar&actual=${movement.id}`} className="text-sm font-medium text-primary">
                          Conciliar
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">Sellado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }
  const monthKey = (report.lastDay ?? "").slice(0, 7);
  const prevKey = previousMonth(monthKey);
  let monthInflows = 0;
  let monthOutflows = 0;
  let prevInflows = 0;
  let prevOutflows = 0;
  for (const account of accounts) {
    for (const movement of account.movements) {
      const key = movement.day.slice(0, 7);
      if (key === monthKey) {
        if (movement.amountCents > 0) monthInflows += movement.amountCents;
        else monthOutflows += Math.abs(movement.amountCents);
      } else if (key === prevKey) {
        if (movement.amountCents > 0) prevInflows += movement.amountCents;
        else prevOutflows += Math.abs(movement.amountCents);
      }
    }
  }
  const snapshot = history.filter((row) => row.month < monthKey).at(-1) ?? null;
  const incomeBase = prevInflows > 0 ? prevInflows : snapshot?.inflows;
  const expenseBase = prevOutflows > 0 ? prevOutflows : snapshot?.outflows;
  const monthNet = monthInflows - monthOutflows;
  const insight = monthNet >= 0
    ? `El neto del mes es ${formatUsd(monthNet)}. El flujo se mantiene positivo.`
    : `El neto del mes es ${formatUsd(monthNet)}. Salieron más de lo que entró.`;
  return (
    <div className="space-y-3">
      {params.error ? <p className="text-sm text-red-700" data-testid="server-error">{params.error}</p> : null}
      <AccountsBoard
        totalCents={report.storedBalanceCents}
        monthInflows={monthInflows}
        monthOutflows={monthOutflows}
        incomeDelta={change(monthInflows, incomeBase)}
        expenseDelta={change(monthOutflows, expenseBase)}
        insight={insight}
        cards={accounts.map((account) => {
          const month = accountMonth(account.movements, monthKey);
          return {
            id: account.id,
            institution: account.institution,
            mask: account.mask,
            kind: account.kind,
            availableBalanceCents: account.availableBalanceCents,
            net: month.monthNet,
            series: account.series,
            origin: account.origin,
            isDemonstration: account.isDemonstration,
            delta: month.delta,
          };
        })}
      />
    </div>
  );
}

function previousMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function accountMonth(movements: { day: string; amountCents: number }[], monthKey: string) {
  const prevKey = previousMonth(monthKey);
  let current = 0;
  let previous = 0;
  let seenPrevious = false;
  for (const row of movements) {
    const key = row.day.slice(0, 7);
    if (key === monthKey) current += row.amountCents;
    if (key === prevKey) {
      previous += row.amountCents;
      seenPrevious = true;
    }
  }
  return { monthNet: current, delta: seenPrevious ? change(current, previous) : null };
}

import { CreditCard, Landmark, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { BankStep } from "@/components/bank-step";
import { InsightStrip } from "@/components/insight-strip";
import { MoneyToggle } from "@/components/money-toggle";
import { StateView } from "@/components/state-view";
import { accountInitials, movementRunningCents } from "@/lib/accounts";
import { RECONCILIATION_LABEL } from "@/lib/labels";
import { accountReading } from "@/lib/reading";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { accountBreakdowns, companyReport } from "@/server/queries";

function kindLabel(kind: string) {
  return kind === "card" ? "Crédito" : "Corriente";
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; paso?: string; actual?: string; error?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cuentas." />;
  const [accounts, report] = await Promise.all([
    accountBreakdowns((await db()), session.actor, session.companyId),
    companyReport((await db()), session.actor, session.companyId),
  ]);
  const selected = accounts.find((account) => account.id === params.cuenta) ?? null;
  if (params.cuenta && !selected) {
    return <StateView variant="error" title="Esa cuenta no está en esta empresa." testId="server-error" />;
  }
  if (selected && params.paso === "conciliar") {
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
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas bancarias</h1>
          <p className="mt-1 text-sm text-slate-500">Elige una cuenta para ver su saldo y sus movimientos. El saldo es el guardado en la base.</p>
        </div>
        <Link href="/cuentas/conectar" data-testid="add-account" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <Plus className="size-4" /> Agregar cuenta
        </Link>
      </div>
      <InsightStrip
        lines={accountReading({
          storedBalanceCents: report.storedBalanceCents,
          net: report.net,
          demonstrationAccountCount: report.demonstrationAccountCount,
          accountCount: accounts.length,
        })}
        testId="cuentas-reading"
      />
      {params.error ? <p className="text-sm text-red-700" data-testid="server-error">{params.error}</p> : null}
      {accounts.length === 0 ? <StateView variant="empty" title="Esta empresa no tiene cuentas bancarias." /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/cuentas?cuenta=${account.id}`}
              data-testid={`account-${account.id}`}
              className="rounded-2xl border border-border bg-white p-4 hover:border-slate-300"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  {account.kind === "card" ? <CreditCard className="size-4" /> : <Landmark className="size-4" />}
                  <span className="text-[10px] font-semibold leading-none">{accountInitials(account.institution)}</span>
                </span>
                <div>
                  <p className="text-xs text-slate-500">{account.institution}</p>
                  <h2 className="font-semibold">{account.productName}</h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{kindLabel(account.kind)} · ····{account.mask}</p>
              <p data-testid="account-balance" className="mt-2 text-2xl font-semibold tracking-tight">{formatUsd(account.availableBalanceCents)}</p>
              <p className="mt-1 text-xs text-slate-500">{account.reconciledCount} de {account.movements.length} conciliados con el banco</p>
              {account.origin === "plaid_demo" ? (
                <p className="mt-2 text-xs text-emerald-700">Conectada con Plaid (demostración)</p>
              ) : account.origin === "manual" ? (
                <p className="mt-2 text-xs text-amber-700">Manual. No está conectada a un banco.</p>
              ) : account.isDemonstration ? (
                <p className="mt-2 text-xs text-amber-700">Demostración</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

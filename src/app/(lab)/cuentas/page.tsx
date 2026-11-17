import { CreditCard, Landmark } from "lucide-react";
import Link from "next/link";
import { BankStep } from "@/components/bank-step";
import { InsightStrip } from "@/components/insight-strip";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    accountBreakdowns(db(), session.actor, session.companyId),
    companyReport(db(), session.actor, session.companyId),
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
        <div>
          <Link href="/cuentas" className="text-sm text-primary">Todas las cuentas</Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
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
          {selected.origin === "manual" ? (
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
            <p className="mt-1 text-lg font-semibold">{formatUsd(selected.inflows)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Salidas</p>
            <p className="mt-1 text-lg font-semibold">{formatUsd(selected.outflows)}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-slate-500">Conciliados</p>
            <p className="mt-1 text-lg font-semibold" data-testid="account-reconciled">{selected.reconciledCount} de {selected.movements.length}</p>
          </article>
        </div>
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
                    <td className="px-4 py-3 text-right">{formatUsd(movement.amountCents)}</td>
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas bancarias</h1>
        <p className="mt-1 text-sm text-slate-500">Elige una cuenta para ver su saldo y sus movimientos. El saldo es el guardado en la base.</p>
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
              {account.origin === "manual" ? (
                <p className="mt-2 text-xs text-amber-700">Manual. No está conectada a un banco.</p>
              ) : account.isDemonstration ? (
                <p className="mt-2 text-xs text-amber-700">Demostración</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
      <form action="/api/accounts" method="post" className="max-w-xl space-y-3 rounded-2xl border border-border bg-white p-4" data-testid="add-account">
        <h2 className="text-base font-semibold">Agregar cuenta</h2>
        <p className="text-sm text-slate-500">Se guarda como cuenta manual de esta empresa. No abre una conexión con el banco.</p>
        <label className="block text-xs text-slate-500">
          Institución
          <Input name="institution" required minLength={2} placeholder="Nombre del banco" className="mt-1" />
        </label>
        <label className="block text-xs text-slate-500">
          Nombre de la cuenta
          <Input name="name" required minLength={2} placeholder="Operativa" className="mt-1" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            Últimos 4
            <Input name="mask" required pattern="\d{4}" maxLength={4} placeholder="4410" className="mt-1" />
          </label>
          <label className="block text-xs text-slate-500">
            Tipo
            <select name="kind" required className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm" defaultValue="bank">
              <option value="bank">Corriente</option>
              <option value="card">Crédito</option>
            </select>
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Saldo inicial (USD)
          <Input name="balance" required placeholder="250.00" className="mt-1" />
        </label>
        <Button type="submit" data-testid="save-account">Guardar cuenta manual</Button>
      </form>
    </section>
  );
}

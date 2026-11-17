import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { InsightStrip } from "@/components/insight-strip";
import { StateView } from "@/components/state-view";
import { accountReading } from "@/lib/reading";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { accountBreakdowns, companyReport } from "@/server/queries";

export default async function AccountsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cuentas." />;
  const [accounts, report] = await Promise.all([
    accountBreakdowns(db(), session.actor, session.companyId),
    companyReport(db(), session.actor, session.companyId),
  ]);
  if (accounts.length === 0) return <StateView variant="empty" title="Esta empresa no tiene cuentas bancarias." />;
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas bancarias</h1>
        <p className="mt-1 text-sm text-slate-500">
          El saldo disponible es el guardado en cada cuenta. Entradas, salidas y neto suman solo sus movimientos.
        </p>
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
      {accounts.map((account) => (
        <article key={account.id} data-testid={`account-${account.id}`} className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500">{account.institution}</p>
              {account.isDemonstration ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Demostración</span> : null}
            </div>
            <h2 className="text-lg font-semibold">{account.productName}</h2>
            <p className="text-sm text-slate-600">{account.kind === "card" ? "Tarjeta de crédito" : "Cuenta bancaria"} · ····{account.mask} · {account.currency}</p>
            <p className="mt-3 text-sm text-slate-500">Saldo disponible</p>
            <p data-testid="account-balance" className="text-2xl font-semibold tracking-tight">{formatUsd(account.availableBalanceCents)}</p>
            <Sparkline points={account.series} color="#2563eb" />
            <p className="text-xs text-slate-500">La línea sigue el importe de cada movimiento, del más antiguo al más reciente.</p>
          </div>
          <div className="grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Entradas</p>
              <p data-testid="account-inflows" className="text-lg font-semibold">{formatUsd(account.inflows)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Salidas</p>
              <p data-testid="account-outflows" className="text-lg font-semibold">{formatUsd(account.outflows)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Neto de movimientos</p>
              <p data-testid="account-net" className="text-lg font-semibold">{formatUsd(account.net)}</p>
            </div>
          </div>
          {account.movements.length === 0 ? (
            <div className="p-4">
              <StateView variant="empty" title="Esta cuenta no tiene movimientos." />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Movimiento</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {account.movements.map((movement) => (
                  <tr key={movement.id} data-testid="account-movement" className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{movement.postedOn}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{movement.merchant}</p>
                      <p className="text-xs text-slate-500">{movement.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{formatUsd(movement.amountCents)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/movimientos?movimiento=${movement.id}`} className="text-sm font-medium text-primary">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      ))}
    </section>
  );
}

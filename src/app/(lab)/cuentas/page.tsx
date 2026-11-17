import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { getHome } from "@/server/queries";

export default async function AccountsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cuentas." />;
  const home = await getHome(db(), session.actor, session.companyId);
  if (home.accounts.length === 0) return <StateView variant="empty" title="Esta empresa no tiene cuentas bancarias." />;
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Cuentas bancarias</h1>
      {home.accounts.map((account) => (
        <article key={account.id} className="rounded-2xl border border-border bg-white p-4">
          <p className="text-sm text-slate-500">{account.institution}</p>
          <h2 className="text-lg font-semibold">{account.productName}</h2>
          <p className="text-sm">····{account.mask} · {account.currency}</p>
          <p className="mt-2 text-2xl font-semibold">{formatUsd(account.availableBalanceCents)}</p>
          <p className="text-xs text-slate-500">Saldo disponible leído de la base de datos.</p>
        </article>
      ))}
    </section>
  );
}

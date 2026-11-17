import Link from "next/link";
import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { incomingMovements } from "@/server/queries";

export default async function ReceivablesPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cobros." />;
  const incoming = await incomingMovements(db(), session.actor, session.companyId);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cobros</h1>
        <p className="mt-1 text-sm text-slate-500">
          No hay facturas abiertas ni vencidas. Estas filas son ingresos que ya entraron al banco. No se registró ningún cobro nuevo.
        </p>
      </div>
      <article className="rounded-2xl border border-border bg-white p-4">
        <p className="text-sm text-slate-500">Ingresos en movimientos</p>
        <p data-testid="cobros-total" className="mt-1 text-3xl font-semibold tracking-tight">
          {formatUsd(incoming.totalCents)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{incoming.rows.length} movimientos de entrada.</p>
      </article>
      {incoming.rows.length === 0 ? (
        <StateView variant="empty" title="No hay ingresos en los movimientos de esta empresa." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Movimiento</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Subcategoría</th>
                <th className="px-4 py-3 text-right font-medium">Ingreso</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {incoming.rows.map((row) => (
                <tr key={row.id} data-testid="cobros-row" className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{row.postedOn}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.subcategory}</td>
                  <td className="px-4 py-3 text-right">{formatUsd(row.amountCents)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/movimientos?movimiento=${row.id}`} className="text-sm font-medium text-primary">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Pendientes abiertos</h2>
        <p className="mt-1 text-sm text-slate-500">Tareas guardadas en la base. No son facturas por cobrar.</p>
        {incoming.openTasks.length === 0 ? (
          <p className="mt-3 text-sm">No hay tareas abiertas.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {incoming.openTasks.map((task) => (
              <li key={task.id} className="rounded-xl border border-border px-3 py-2">
                {task.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { expenseAnalysis } from "@/server/queries";

export default async function PayablesPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa." />;
  const analysis = await expenseAnalysis(db(), session.actor, session.companyId);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Por pagar</h1>
        <p className="mt-1 text-sm text-slate-500">
          No hay facturas por pagar y no se registró ningún pago. Este laboratorio no tiene un libro de cuentas por pagar.
          Lo que sigue son gastos que ya salieron del banco.
        </p>
      </div>
      <StateView
        variant="empty"
        title="No hay saldos por pagar."
        description="Sin facturas pendientes no hay nada que pagar desde aquí."
      />
      {analysis.rows.length === 0 ? null : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Gastos ya debitados</h2>
            <p className="text-xs text-slate-500">Total {formatUsd(analysis.totalCents)}. El detalle por categoría está en el análisis de gastos.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Movimiento</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 text-right font-medium">Importe</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{row.postedOn}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.merchant}</p>
                    <p className="text-xs text-slate-500">{row.subcategory}</p>
                  </td>
                  <td className="px-4 py-3">{row.category}</td>
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
          <p className="px-4 py-3 text-sm">
            <Link href="/gastos" className="font-medium text-primary">Abrir el análisis de gastos</Link>
          </p>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { BoardViewer } from "@/components/board-viewer";
import { ReviewBoard } from "@/components/review-board";
import { SessionLink } from "@/components/post-link";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { firmQueue, getBoardReceipt, reviewBoard } from "@/server/queries";

const TITLES: Record<string, string> = {
  revisar: "Movimientos por revisar",
  comprobantes: "Comprobantes faltantes",
  aclaraciones: "Aclaraciones abiertas",
  aprobar: "Listos para aprobar",
  duplicados: "Comprobantes duplicados",
  empresas: "Empresas asignadas",
};

export default async function FirmListPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; movimiento?: string; error?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  const tipo = params.tipo && TITLES[params.tipo] ? params.tipo : "revisar";
  try {
    if (tipo === "revisar") {
      const groups = await reviewBoard((await db()), session.actor);
      const viewer = params.movimiento
        ? await getBoardReceipt((await db()), session.actor, { transactionId: params.movimiento })
        : null;
      const next = params.movimiento ? `/firma/lista?tipo=revisar&movimiento=${params.movimiento}` : "/firma/lista?tipo=revisar";
      return (
        <div className={viewer ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Despacho</p>
                <h1 className="text-2xl font-semibold tracking-tight">Revisión</h1>
                <p className="mt-1 text-sm text-slate-500">Aprobar y sellar mueve la tarjeta a Sellado. Una aclaración la mueve a Esperando cliente.</p>
              </div>
              <Link href="/firma" className="text-sm font-medium text-primary">Volver al inicio</Link>
            </div>
            <div className="mt-4">
              <ReviewBoard groups={groups} activeId={params.movimiento} />
            </div>
          </section>
          {viewer ? <BoardViewer viewer={{ ...viewer, closeHref: "/firma/lista?tipo=revisar", next }} error={params.error} /> : null}
        </div>
      );
    }
    const rows = await firmQueue((await db()), session.actor, tipo);
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Despacho</p>
            <h1 className="text-2xl font-semibold tracking-tight">{TITLES[tipo]}</h1>
          </div>
          <Link href="/firma" className="text-sm font-medium text-primary">Volver al inicio</Link>
        </div>
        {rows.length === 0 ? (
          <StateView variant="empty" title="No hay elementos en esta lista." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Elemento</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-testid="firm-queue-row" className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{row.companyName}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-slate-500">{row.detail}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SessionLink href={row.href} className="font-medium text-primary">Abrir</SessionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">{rows.length} en esta lista. El conteo sale de las empresas asignadas.</p>
      </section>
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

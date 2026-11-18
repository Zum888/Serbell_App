import { FocusMode } from "@/components/focus-mode";
import { MovementsScreen } from "@/components/movements-screen";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { formatUsd } from "@/lib/money";
import { canReview } from "@/lib/permissions";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { focusQueue } from "@/server/focus";
import { getHome, getMovement, getReceiptContext, listCategoryTree, listMovements, movementCounts } from "@/server/queries";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; movimiento?: string; error?: string; fila?: string; recibo?: string; vista?: string; actual?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus movimientos." />;
  const filter = params.filtro || "todos";
  const q = params.q || "";
  try {
    const tree = await listCategoryTree((await db()), session.actor, session.companyId);
    const categories = tree.map((parent) => ({
      id: parent.id,
      name: parent.name,
      children: parent.children.map((child) => ({ id: child.id, name: child.name })),
    }));
    if (params.vista === "enfoque") {
      const home = await getHome((await db()), session.actor, session.companyId);
      const focus = await focusQueue((await db()), session.actor, session.companyId, params.actual);
      return (
        <FocusMode
          data={{
            companyName: home.company.name,
            canReview: canReview(session.actor, session.companyId),
            total: focus.total,
            pending: focus.pending,
            merchantPending: focus.merchantPending,
            suggestions: focus.suggestions,
            choices: focus.choices,
            categories,
            error: params.error,
            current: focus.current,
            ticket: focus.ticket,
          }}
        />
      );
    }
    const [rows, counts, home] = await Promise.all([
      listMovements((await db()), session.actor, session.companyId, filter, q),
      movementCounts((await db()), session.actor, session.companyId),
      getHome((await db()), session.actor, session.companyId),
    ]);
    let detail = null;
    let receipt = null;
    if (params.fila) {
      receipt = await getReceiptContext((await db()), session.actor, params.fila);
    } else if (params.movimiento) {
      detail = await getMovement((await db()), session.actor, params.movimiento);
    }
    return (
      <MovementsScreen
        companyName={home.company.name}
        companyId={session.companyId}
        balanceLabel={`Disponible en las ${home.accountCount} cuentas · ${formatUsd(home.balanceCents)}`}
        rows={rows}
        counts={counts}
        filter={filter}
        q={q}
        error={params.error}
        detail={detail}
        receipt={receipt}
        canReview={canReview(session.actor, session.companyId)}
        categories={categories}
      />
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

import { MovementsScreen } from "@/components/movements-screen";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { formatUsd } from "@/lib/money";
import { canReview } from "@/lib/permissions";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { getHome, getMovement, getReceiptContext, listCategoryTree, listMovements, movementCounts } from "@/server/queries";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; movimiento?: string; error?: string; fila?: string; recibo?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus movimientos." />;
  const filter = params.filtro || "todos";
  const q = params.q || "";
  try {
    const [rows, counts, home, tree] = await Promise.all([
      listMovements(db(), session.actor, session.companyId, filter, q),
      movementCounts(db(), session.actor, session.companyId),
      getHome(db(), session.actor, session.companyId),
      listCategoryTree(db(), session.actor, session.companyId),
    ]);
    let detail = null;
    let receipt = null;
    if (params.fila) {
      receipt = await getReceiptContext(db(), session.actor, params.fila);
    } else if (params.movimiento) {
      detail = await getMovement(db(), session.actor, params.movimiento);
    }
    return (
      <MovementsScreen
        companyName={home.company.name}
        balanceLabel={`Disponible en las ${home.accountCount} cuentas · ${formatUsd(home.balanceCents)}`}
        rows={rows}
        counts={counts}
        filter={filter}
        q={q}
        error={params.error}
        detail={detail}
        receipt={receipt}
        canReview={canReview(session.actor, session.companyId)}
        categories={tree.map((parent) => ({
          name: parent.name,
          children: parent.children.map((child) => ({ id: child.id, name: child.name })),
        }))}
      />
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

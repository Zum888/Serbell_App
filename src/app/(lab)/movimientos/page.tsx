import { FocusMode } from "@/components/focus-mode";
import { MovementsScreen } from "@/components/movements-screen";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { LOTE } from "@/lib/lote";
import { canReview } from "@/lib/permissions";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { focusQueue } from "@/server/focus";
import { monthHistory } from "@/server/planning";
import { getHome, getMovement, getReceiptContext, listCategoryTree, listMovements } from "@/server/queries";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; movimiento?: string; error?: string; fila?: string; recibo?: string; vista?: string; actual?: string; duplicado?: string; decision?: string; faltantes?: string; cuenta?: string; factura?: string; lote?: string; con?: string; flujo?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus bancos." />;
  const filter = params.filtro || "todos";
  const q = params.q || "";
  try {
    const categories = await listCategoryTree((await db()), session.actor, session.companyId);
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
    const home = await getHome((await db()), session.actor, session.companyId);
    const account = params.cuenta ? home.accounts.find((item) => item.id === params.cuenta) : undefined;
    if (params.cuenta && !account) {
      return <StateView variant="error" title="Esa cuenta no está en esta empresa." testId="server-error" />;
    }
    const database = await db();
    const rows = await listMovements(database, session.actor, session.companyId, "todos", "");
    const history = await monthHistory(database, session.actor, session.companyId);
    const latest = rows.reduce((max, row) => (row.postedOn > max ? row.postedOn : max), "");
    const prior = history.filter((row) => row.month < latest.slice(0, 7)).at(-1) ?? null;
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
        accounts={home.accounts.map((item) => ({ id: item.id, institution: item.institution, mask: item.mask, availableBalanceCents: item.availableBalanceCents }))}
        accountId={account?.id}
        found={params.factura === "lista" ? ["tx_qpl_fs_20394"] : params.lote === "lista" ? LOTE.map((item) => item.id) : []}
        notice={params.factura === "lista" ? "factura" : params.lote === "lista" ? "lote" : undefined}
        rows={rows}
        filter={filter}
        q={q}
        error={params.error}
        detail={detail}
        receipt={receipt}
        canReview={canReview(session.actor, session.companyId)}
        categories={categories}
        duplicate={params.duplicado === "sunpass"}
        decision={params.decision}
        missing={params.faltantes === "1"}
        withChat={params.con === "chat"}
        flujo={params.flujo}
        priorMonth={prior ? { inflows: prior.inflows, outflows: prior.outflows } : null}
      />
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

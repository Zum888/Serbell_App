import Link from "next/link";
import { redirect } from "next/navigation";
import { BankStep } from "@/components/bank-step";
import { ChatRail } from "@/components/chat-rail";
import { StateView } from "@/components/state-view";
import { movementRunningCents } from "@/lib/accounts";
import { LOTE, LOTE_ACCOUNT, loteItem, loteNextHref } from "@/lib/lote";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { accountBreakdowns } from "@/server/queries";

function autoMatchFor(
  params: { factura?: string; lote?: string; actual?: string },
  accountId: string,
  transactionId: string,
  movements: ScanMovement[],
) {
  const rows = searchRows(movements, transactionId);
  const hit = movements.find((row) => row.id === transactionId);
  if (!hit || rows.length === 0) return null;
  const shared = {
    amountLabel: formatUsd(Math.abs(hit.amountCents)),
    dateLabel: hit.postedOn,
    rows,
  };
  if (params.factura === "1" && transactionId === "tx_qpl_fs_20394") {
    return {
      ...shared,
      file: "Factura_FleetSmarts.pdf",
      nextHref: `/movimientos?cuenta=${accountId}&factura=lista`,
      note: "Lo concilio.",
    };
  }
  if (params.lote === "1" && accountId === LOTE_ACCOUNT) {
    const item = loteItem(params.actual);
    if (item && item.id === transactionId) {
      const index = LOTE.findIndex((row) => row.id === item.id) + 1;
      return {
        ...shared,
        file: item.fileName,
        nextHref: loteNextHref(item.id),
        note: index === LOTE.length ? "Cierro el lote." : `Van ${index} de ${LOTE.length}.`,
      };
    }
  }
  return null;
}

type ScanMovement = { id: string; day: string; merchant: string; postedOn: string; amountCents: number };

function searchRows(movements: ScanMovement[], hitId: string) {
  const hit = movements.find((row) => row.id === hitId);
  if (!hit) return [];
  const hitTime = Date.parse(hit.day);
  const decoys = movements
    .filter((row) => row.id !== hitId)
    .sort((a, b) => Math.abs(Date.parse(a.day) - hitTime) - Math.abs(Date.parse(b.day) - hitTime))
    .slice(0, 3)
    .sort((a, b) => a.day.localeCompare(b.day) || a.merchant.localeCompare(b.merchant));
  return [...decoys, hit].map((row) => ({
    id: row.id,
    merchant: row.merchant,
    postedOn: row.postedOn,
    amountCents: row.amountCents,
    hit: row.id === hitId,
  }));
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string; paso?: string; actual?: string; error?: string; factura?: string; lote?: string; con?: string; flujo?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus cuentas." />;
  const database = await db();
  const accounts = await accountBreakdowns(database, session.actor, session.companyId);
  const selected = accounts.find((account) => account.id === params.cuenta) ?? null;
  if (params.cuenta && !selected) {
    return <StateView variant="error" title="Esa cuenta no está en esta empresa." testId="server-error" />;
  }
  if (params.paso !== "conciliar") {
    const next = new URLSearchParams();
    if (params.cuenta) next.set("cuenta", params.cuenta);
    if (params.factura) next.set("factura", params.factura);
    if (params.lote) next.set("lote", params.lote);
    if (params.error) next.set("error", params.error);
    if (params.con === "chat") {
      next.set("con", "chat");
      if (params.flujo) next.set("flujo", params.flujo);
    }
    const query = next.toString();
    redirect(query ? `/movimientos?${query}` : "/movimientos");
  }
  if (selected && params.paso === "conciliar") {
    if (params.lote === "1" && selected.id === LOTE_ACCOUNT) {
      const item = loteItem(params.actual);
      const movement = item ? selected.movements.find((row) => row.id === item.id) : null;
      if (item && (!movement || movement.reconciliationState === "Reconciled" || movement.sealed)) {
        redirect(loteNextHref(item.id));
      }
    }
    const open = [...selected.movements]
      .filter((movement) => movement.reconciliationState !== "Reconciled")
      .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
    const current = open.find((movement) => movement.id === params.actual) ?? open[0] ?? null;
    const chat = params.con === "chat";
    const keep = (href: string) => (chat && !href.includes("con=chat") ? `${href}${href.includes("?") ? "&" : "?"}con=chat&flujo=${params.flujo || "lote"}` : href);
    if (!current) {
      return (
        <section>
          <Link href={keep(`/movimientos?cuenta=${selected.id}`)} className="text-sm text-primary">Volver a la cuenta</Link>
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
    const step = (
      <BankStep
        error={params.error}
        autoMatch={autoMatchFor(params, selected.id, current.id, selected.movements)}
        data={{
          accountHref: keep(`/movimientos?cuenta=${selected.id}`),
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
          nextSkip: next ? keep(`/cuentas?cuenta=${selected.id}&paso=conciliar&actual=${next.id}${params.lote ? `&lote=${params.lote}` : ""}`) : null,
        }}
      />
    );
    if (!chat) return step;
    return (
      <div className="flex items-start gap-4">
        <ChatRail flujo={params.flujo || "lote"} />
        <div className="min-w-0 flex-1">{step}</div>
      </div>
    );
  }
  redirect("/movimientos");
}

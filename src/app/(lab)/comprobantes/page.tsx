import { BoardViewer } from "@/components/board-viewer";
import { DocumentBoard } from "@/components/document-board";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { documentBoard, getBoardReceipt } from "@/server/queries";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ recibo?: string; fila?: string; error?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus comprobantes." />;
  const company = session.companies.find((item) => item.id === session.companyId);
  try {
    const groups = await documentBoard(db(), session.actor, session.companyId);
    const viewer = params.recibo || params.fila
      ? await getBoardReceipt(db(), session.actor, { documentId: params.recibo, transactionId: params.fila })
      : null;
    const nextParams = new URLSearchParams();
    if (params.recibo) nextParams.set("recibo", params.recibo);
    if (params.fila) nextParams.set("fila", params.fila);
    const next = `/comprobantes${nextParams.size ? `?${nextParams}` : ""}`;
    return (
      <div className={viewer ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
        <section>
          <p className="text-xs text-slate-500">{company?.name}</p>
          <h1 className="text-2xl font-semibold">Comprobantes</h1>
          <p className="mt-1 text-sm text-slate-500">Una tarjeta cambia de columna cuando confirmas el vínculo, cambias el comprobante o el contador lo sella.</p>
          <div className="mt-4">
            <DocumentBoard groups={groups} activeId={params.recibo} />
          </div>
        </section>
        {viewer ? (
          <BoardViewer
            viewer={{ ...viewer, closeHref: "/comprobantes", next }}
            error={params.error}
          />
        ) : null}
      </div>
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}

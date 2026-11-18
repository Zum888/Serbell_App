import { BoardViewer } from "@/components/board-viewer";
import { DocumentGallery, type GalleryCard } from "@/components/document-gallery";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { documentBoard, getBoardReceipt } from "@/server/queries";

const COLUMN_LABEL: Record<string, string> = {
  recibido: "Recibido",
  procesado: "Procesado",
  listo: "Listo para el contador",
  sellado: "Aprobado y sellado",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ recibo?: string; fila?: string; error?: string; foco?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus comprobantes." />;
  const company = session.companies.find((item) => item.id === session.companyId);
  try {
    const groups = await documentBoard(db(), session.actor, session.companyId);
    const cards: GalleryCard[] = (Object.keys(groups) as (keyof typeof groups)[]).flatMap((column) =>
      groups[column].map((card) => ({
        id: card.id,
        fileName: card.fileName,
        merchant: card.merchant,
        amountLabel: card.amountLabel,
        amountCents: card.amountCents,
        dateLabel: card.dateLabel,
        day: card.day,
        duplicate: card.duplicate,
        conflict: card.conflict,
        status: column,
        statusLabel: COLUMN_LABEL[column] ?? column,
        movementId: card.movement?.id ?? null,
      })),
    );
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
          <p className="mt-1 text-sm text-slate-500">Como en Finder: cambia entre íconos, lista o carpetas. Barra espaciadora para la vista rápida, flechas para moverte y ⌘ o Shift + clic para elegir varios.</p>
          <div className="mt-4">
            <DocumentGallery cards={cards} />
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

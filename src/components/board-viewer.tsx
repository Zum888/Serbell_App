import Link from "next/link";
import { ReceiptFrame } from "@/components/receipt-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BoardViewerData = {
  document: { id: string; fileName: string; mimeType: string; merchant: string; amountLabel: string; dateLabel: string } | null;
  movement: { id: string; merchant: string; amountLabel: string; dateLabel: string; sealed: boolean } | null;
  candidates: { transactionId: string; merchant: string; amountLabel: string; dateLabel: string }[];
  choices: { id: string; fileName: string }[];
  duplicate: boolean;
  duplicateOfName: string | null;
  conflict: boolean;
  canReview: boolean;
  auditNote: string | null;
  closeHref: string;
  next: string;
};

export function BoardViewer({ viewer, error }: { viewer: BoardViewerData; error?: string }) {
  const sealed = Boolean(viewer.movement?.sealed);
  return (
    <aside data-testid="receipt-panel" className="rounded-2xl border border-border bg-white p-4 lg:sticky lg:top-4">
      <p className="text-xs text-slate-500">Comprobante</p>
      <h2 className="text-lg font-semibold">{viewer.document?.merchant || viewer.movement?.merchant || "Sin datos"}</h2>
      <p className="text-sm text-slate-600">{viewer.document?.fileName ?? "Sin comprobante"}</p>
      {viewer.document ? (
        <p className="text-sm text-slate-500">{viewer.document.amountLabel} · {viewer.document.dateLabel}</p>
      ) : viewer.movement ? (
        <p className="text-sm text-slate-500">{viewer.movement.amountLabel} · {viewer.movement.dateLabel}</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700" data-testid="server-error">{error}</p> : null}
      {viewer.duplicate ? (
        <p className="mt-2 text-xs text-amber-700" data-testid="dup-mark">Duplicado{viewer.duplicateOfName ? ` de ${viewer.duplicateOfName}` : ""}.</p>
      ) : null}
      {viewer.conflict ? <p className="mt-2 text-xs text-red-700" data-testid="conflict-mark">Conflicto. El movimiento ya tiene otro comprobante.</p> : null}
      {viewer.document ? (
        <ReceiptFrame
          src="/demo/comprobante.svg"
          mime={viewer.document.mimeType}
          fileName={viewer.document.fileName}
          closeHref={viewer.closeHref}
        />
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Este movimiento no tiene comprobante.</p>
          <Link href={viewer.closeHref} data-testid="receipt-close" className="mt-3 inline-flex text-sm text-slate-500">Cerrar</Link>
        </div>
      )}
      {viewer.movement ? (
        <p className="mt-3 text-xs text-slate-600" data-testid="linked-movement">
          Movimiento: {viewer.movement.merchant} · {viewer.movement.dateLabel} · {viewer.movement.amountLabel}
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Sin movimiento vinculado.</p>
      )}
      {viewer.auditNote ? <p data-testid="receipt-audit" className="mt-2 text-xs text-slate-600">{viewer.auditNote}</p> : null}
      {sealed ? <p className="mt-3 text-xs text-slate-500">Sellado. El servidor rechaza el cambio.</p> : null}
      {!sealed && viewer.candidates.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-slate-500">Confirmar el movimiento</p>
          {viewer.candidates.map((candidate) => (
            <form key={candidate.transactionId} action={`/api/documents/${viewer.document?.id}/link`} method="post" className="rounded-xl border border-border p-2">
              <input type="hidden" name="transactionId" value={candidate.transactionId} />
              <input type="hidden" name="next" value={viewer.next} />
              <p className="text-sm font-medium">{candidate.merchant}</p>
              <p className="text-xs text-slate-500">{candidate.dateLabel} · {candidate.amountLabel}</p>
              <Button type="submit" className="mt-2" data-testid={`confirm-${candidate.transactionId}`}>
                {viewer.candidates.length === 1 ? "Confirmar vínculo" : "Elegir este movimiento"}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      {!sealed && viewer.movement && viewer.document ? (
        <div className="mt-4 space-y-4">
          <form action={`/api/transactions/${viewer.movement.id}/document`} method="post" className="space-y-2">
            <input type="hidden" name="next" value={viewer.next} />
            <label className="block text-xs text-slate-500">
              Otro comprobante guardado
              <select name="documentId" data-testid="receipt-choice" className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm" defaultValue="">
                <option value="">Elegir</option>
                {viewer.choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.fileName}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" data-testid="receipt-use">Usar este</Button>
          </form>
          <p className="text-xs text-slate-500">Los comprobantes son de demostración. No se pueden subir ni descargar.</p>
        </div>
      ) : null}
      {viewer.canReview && viewer.movement && !sealed ? (
        <div className="mt-4 space-y-3">
          <form action={`/api/transactions/${viewer.movement.id}/seal`} method="post">
            <input type="hidden" name="next" value={viewer.next} />
            <Button type="submit" data-testid="approve-seal">Aprobar y sellar</Button>
          </form>
          <form action={`/api/transactions/${viewer.movement.id}/clarification`} method="post" className="space-y-2">
            <input type="hidden" name="next" value={viewer.next} />
            <Input name="message" placeholder="Pedir una aclaración al cliente" />
            <Button type="submit" variant="outline">Solicitar aclaración</Button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}

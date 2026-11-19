import Link from "next/link";
import { ReceiptFrame } from "@/components/receipt-frame";
import { Button } from "@/components/ui/button";

export function ReceiptPanel({
  receipt,
  filter,
  q,
  error,
}: {
  receipt: {
    transactionId: string;
    merchant: string;
    sealed: boolean;
    document: { id: string; fileName: string; mimeType: string } | null;
    choices: { id: string; fileName: string }[];
    auditNote: string | null;
  };
  filter: string;
  q: string;
  error?: string;
}) {
  const params = new URLSearchParams();
  if (filter && filter !== "todos") params.set("filtro", filter);
  if (q) params.set("q", q);
  const closeHref = `/movimientos${params.size ? `?${params}` : ""}`;
  return (
    <aside data-testid="receipt-panel" className="rounded-2xl border border-border bg-white p-4 lg:sticky lg:top-4">
      <p className="text-xs text-slate-500">Comprobante</p>
      <h2 className="text-lg font-semibold">{receipt.merchant}</h2>
      <p className="text-sm text-slate-600">{receipt.document?.fileName ?? "Sin comprobante"}</p>
      {error ? <p className="mt-2 text-sm text-red-700" data-testid="server-error">{error}</p> : null}
      {receipt.document ? (
        <ReceiptFrame
          src="/demo/comprobante.svg"
          mime={receipt.document.mimeType}
          fileName={receipt.document.fileName}
          closeHref={closeHref}
        />
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Este movimiento no tiene comprobante.</p>
          <Link href={closeHref} data-testid="receipt-close" className="mt-3 inline-flex text-sm text-slate-500">Cerrar</Link>
        </div>
      )}
      {receipt.auditNote ? <p data-testid="receipt-audit" className="mt-3 text-xs text-slate-600">{receipt.auditNote}</p> : null}
      {receipt.sealed ? (
        <p className="mt-3 text-xs text-slate-500">Sellado. El servidor rechaza el cambio del comprobante.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <form action={`/api/transactions/${receipt.transactionId}/document`} method="post" className="space-y-2">
            <input type="hidden" name="filtro" value={filter === "todos" ? "" : filter} />
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="recibo" value={receipt.document?.id ?? ""} />
            <label className="block text-xs text-slate-500">
              {receipt.document ? "Otro comprobante guardado" : "Comprobante guardado"}
              <select name="documentId" data-testid="receipt-choice" className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm" defaultValue="">
                <option value="">Elegir</option>
                {receipt.choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.fileName}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" data-testid="receipt-use">Usar este</Button>
          </form>
          <p className="text-xs text-slate-500">Los comprobantes son de demostración. No se pueden subir ni descargar.</p>
        </div>
      )}
    </aside>
  );
}

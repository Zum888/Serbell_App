import { Check, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatUsd } from "@/lib/money";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  status: string;
  notice: string;
  isDemonstration: boolean;
  merchant: string;
  amountCents: number | null;
  occurredOn: string;
  occurredLabel: string;
  verified: boolean;
  decision: string | null;
  reasonsFor: string[];
  reasonsAgainst: string[];
  linkedTransactionId: string | null;
  linkedReview: string | null;
  linkedSealed: boolean;
  proposedTransactionId: string | null;
  candidates: {
    transactionId: string;
    merchant: string;
    postedOn: string;
    amountCents: number;
    blocked: boolean;
    reasonsFor: string[];
    reasonsAgainst: string[];
  }[];
};

export function ChatScreen({
  companyId,
  companyName,
  uploadHint,
  error,
  messages,
  document,
}: {
  companyId: string;
  companyName: string;
  uploadHint: boolean;
  error?: string;
  messages: { id: string; role: string; body: string; author: string; at: string }[];
  document: ChatDocument | null;
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-border bg-white">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Serbell</p>
            <p className="text-xs text-slate-500">Asistente del laboratorio · {companyName}</p>
          </div>
        </header>
        <div className="space-y-3 px-4 py-4">
          {error ? <StateView variant="error" title={error} testId="server-error" /> : null}
          {messages.length === 0 ? <StateView variant="empty" title="Todavía no hay mensajes." /> : null}
          {messages.map((message) => (
            <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[80%] rounded-2xl bg-blue-50 px-3 py-2 text-sm" : "max-w-[80%] rounded-2xl border border-border px-3 py-2 text-sm"}>
              <p className="text-xs text-slate-500">{message.author} · {message.at}</p>
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            </article>
          ))}
          <form action="/api/documents" method="post" encType="multipart/form-data" className={uploadHint ? "rounded-2xl border border-blue-200 bg-blue-50 p-3" : "rounded-2xl border border-dashed border-border p-3"}>
            <input type="hidden" name="companyId" value={companyId} />
            <label className="block text-sm font-medium" htmlFor="comprobante">
              Adjuntar comprobante
            </label>
            <input id="comprobante" data-testid="chat-file-input" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="mt-2 block w-full text-sm" />
            <div className="mt-3">
              <Button type="submit" data-testid="upload-submit">Adjuntar</Button>
            </div>
          </form>
          <form action="/api/documents/use-demo" method="post">
            <input type="hidden" name="companyId" value={companyId} />
            <button type="submit" data-testid="demo-ticket" className="inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm">
              Adjuntar ticket de demostración FleetSmarts
            </button>
          </form>
        </div>
        <form action="/api/chat" method="post" className="flex gap-2 border-t border-border p-3">
          <input type="hidden" name="companyId" value={companyId} />
          <Input name="text" required placeholder="Escribe un mensaje a Serbell..." />
          <Button type="submit">Enviar</Button>
        </form>
      </section>
      <aside className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Conciliación del comprobante</h2>
        {!document ? <div className="mt-4"><StateView variant="empty" title="Adjunta un comprobante para ver la conciliación." /></div> : <DocumentPanel document={document} />}
      </aside>
    </div>
  );
}

function DocumentPanel({ document }: { document: ChatDocument }) {
  const steps = [
    { label: "Comprobante recibido", done: true },
    { label: "Vincular con movimiento", done: Boolean(document.linkedTransactionId) },
    { label: "Revisión del contador", done: document.linkedReview === "Approved" || document.linkedReview === "NeedsClient" },
    { label: "Aprobación y sellado", done: document.linkedSealed },
  ];
  const hasFields = Boolean(document.merchant) && document.amountCents !== null;
  return (
    <div className="mt-4 space-y-4">
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2 text-sm">
            <span className={step.done ? "flex size-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white" : "flex size-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500"}>
              {step.done ? <Check className="size-3" /> : index + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-border p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <FileText className="size-4" /> {document.fileName}
        </p>
        {document.isDemonstration ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Vista de demostración del ticket</p>
            <p className="mt-2 font-semibold">FLEETSMARTS</p>
            <p>12 oct 2026</p>
            <p>TOTAL USD 203.94</p>
          </div>
        ) : document.mimeType.startsWith("image/") ? (
          <img src={`/api/documents/${document.id}/file`} alt={document.fileName} className="mt-3 max-h-40 rounded-lg border border-border" />
        ) : null}
        <p className="mt-3 text-slate-600">{document.notice}</p>
        {document.isDemonstration ? (
          <p data-testid="extraction-demo-badge" className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Dato de demostración
          </p>
        ) : null}
        {hasFields ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <dt className="text-xs text-slate-500">Comercio</dt>
              <dd data-testid="extraction-merchant">{document.merchant}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Fecha</dt>
              <dd data-testid="extraction-date">{document.occurredLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Importe</dt>
              <dd data-testid="extraction-amount">{document.amountCents !== null ? formatUsd(document.amountCents) : "Sin importe"}</dd>
            </div>
          </dl>
        ) : (
          <form action={`/api/documents/${document.id}/extraction`} method="post" className="mt-3 space-y-2">
            <Input name="merchant" required placeholder="Comercio" />
            <Input name="occurredOn" type="date" />
            <Input name="amount" required placeholder="Importe, por ejemplo 203.94" />
            <Button type="submit">Guardar datos</Button>
          </form>
        )}
      </div>
      {hasFields && !document.verified ? (
        <form action={`/api/documents/${document.id}/confirm`} method="post">
          <Button type="submit" data-testid="confirm-extraction">Confirmar datos</Button>
        </form>
      ) : null}
      {document.linkedTransactionId ? (
        <StateView variant="success" testId="link-success" title="Vínculo confirmado." description="El comprobante quedó ligado al movimiento." />
      ) : null}
      {document.verified && !document.linkedTransactionId ? (
        <div data-testid="match-reasons" className="rounded-xl border border-border p-3 text-sm">
          <p className="font-medium">Evidencia de la coincidencia</p>
          {document.decision === "reliable" ? (
            <ul className="mt-2 space-y-1 text-emerald-800">
              {document.reasonsFor.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {document.decision === "ambiguous" ? <p className="mt-2">Hay más de un movimiento compatible. Elige uno.</p> : null}
          {document.decision === "conflict" || document.status === "conflict" ? (
            <p className="mt-2">El movimiento compatible ya tiene un comprobante vinculado. No se asigna otro automáticamente.</p>
          ) : null}
          {document.decision === "duplicate" || document.status === "duplicate" ? (
            <p className="mt-2">Ya existe un comprobante con el mismo archivo, o con el mismo comercio, importe y fecha.</p>
          ) : null}
          {document.status === "pending" || document.decision === "none" ? (
            <p className="mt-2">No hay un movimiento con el mismo importe y comercio. El comprobante queda pendiente.</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {document.candidates.filter((candidate) => !candidate.blocked).map((candidate) => {
              const choose = document.decision === "ambiguous" || (document.decision === "reliable" && document.proposedTransactionId === candidate.transactionId);
              return (
                <div key={candidate.transactionId} className="rounded-lg border border-border p-2">
                  <p className="font-medium">{candidate.merchant}</p>
                  <p className="text-xs text-slate-500">{candidate.postedOn} · {formatUsd(candidate.amountCents)}</p>
                  {choose ? (
                    <form action={`/api/documents/${document.id}/link`} method="post" className="mt-2">
                      <input type="hidden" name="transactionId" value={candidate.transactionId} />
                      <Button type="submit" data-testid={document.decision === "reliable" ? "confirm-link" : `choose-${candidate.transactionId}`}>
                        {document.decision === "reliable" ? "Confirmar vínculo" : "Elegir este movimiento"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
          {document.decision === "reliable" || document.decision === "ambiguous" ? (
            <form action={`/api/documents/${document.id}/postpone`} method="post" className="mt-3">
              <Button type="submit" variant="outline">Revisar después</Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {document.linkedTransactionId ? (
        <Link href={`/movimientos?movimiento=${document.linkedTransactionId}`} className="inline-flex text-sm font-medium text-primary">
          Ver en movimientos
        </Link>
      ) : null}
    </div>
  );
}

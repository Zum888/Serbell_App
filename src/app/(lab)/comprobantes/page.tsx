import { StateView } from "@/components/state-view";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { listDocuments } from "@/server/queries";

export default async function DocumentsPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para ver sus comprobantes." />;
  const documents = await listDocuments(db(), session.actor, session.companyId);
  return (
    <section className="rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <h1 className="text-2xl font-semibold">Comprobantes</h1>
      </div>
      {documents.length === 0 ? (
        <div className="p-4"><StateView variant="empty" title="No hay comprobantes cargados." /></div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Archivo</th>
              <th className="px-4 py-2 font-medium">Comercio</th>
              <th className="px-4 py-2 font-medium">Importe</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="border-b border-border">
                <td className="px-4 py-2">{document.fileName}</td>
                <td className="px-4 py-2">{document.merchant ?? "Sin datos"}</td>
                <td className="px-4 py-2">{document.amountCents !== null ? formatUsd(document.amountCents) : "—"}</td>
                <td className="px-4 py-2">{document.occurredOn}</td>
                <td className="px-4 py-2">{document.linked ? "Vinculado" : document.status}{document.isDemonstration ? " · demostración" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

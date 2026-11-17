import { greetingName } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { StateView } from "@/components/state-view";

type CompanyRow = {
  id: string;
  name: string;
  industry: string;
  awaitingReview: number;
  pendingReceipts: number;
  clarifications: number;
  readyToApprove: number;
  duplicates: number;
};

export function FirmScreen({
  name,
  q,
  summary,
}: {
  name: string;
  q: string;
  summary: {
    assigned: number;
    awaitingReview: number;
    pendingReceipts: number;
    clarifications: number;
    readyToApprove: number;
    duplicates: number;
    companies: CompanyRow[];
  };
}) {
  const needle = q.trim().toLowerCase();
  const companies = summary.companies.filter((company) => !needle || company.name.toLowerCase().includes(needle) || company.industry.toLowerCase().includes(needle));
  const cards = [
    ["Empresas asignadas", summary.assigned],
    ["Por revisar", summary.awaitingReview],
    ["Comprobantes faltantes", summary.pendingReceipts],
    ["Aclaraciones", summary.clarifications],
    ["Listas para aprobar", summary.readyToApprove],
    ["Duplicados", summary.duplicates],
  ] as const;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Buenos días, {greetingName(name)}.</h1>
        <p className="mt-1 text-sm text-slate-500">Prioridades calculadas con los movimientos reales de las empresas asignadas.</p>
      </div>
      <form action="/firma">
        <Input name="q" defaultValue={q} placeholder="Buscar empresa" />
      </form>
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border bg-white p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>
      {companies.length === 0 ? <StateView variant="empty" title="Ninguna empresa coincide con la búsqueda." /> : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Por revisar</th>
                <th className="px-4 py-3 font-medium">Sin comprobante</th>
                <th className="px-4 py-3 font-medium">Aclaraciones</th>
                <th className="px-4 py-3 font-medium">Listas para aprobar</th>
                <th className="px-4 py-3 font-medium">Duplicados</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-slate-500">{company.industry}</p>
                  </td>
                  <td className="px-4 py-3">{company.awaitingReview}</td>
                  <td className="px-4 py-3">{company.pendingReceipts}</td>
                  <td className="px-4 py-3">{company.clarifications}</td>
                  <td className="px-4 py-3">{company.readyToApprove}</td>
                  <td className="px-4 py-3">{company.duplicates}</td>
                  <td className="px-4 py-3 text-right">
                    <a data-testid={`company-open-${company.id}`} className="font-medium text-primary" href={`/api/session/company?companyId=${company.id}&next=/movimientos`}>
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { Building2, CheckCheck, Copy, FileWarning, MessageSquare, ClipboardList } from "lucide-react";
import { Bars, Sparkline } from "@/components/charts";
import { InsightStrip } from "@/components/insight-strip";
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
  const busiest = [...summary.companies].sort((a, b) => b.awaitingReview - a.awaitingReview || a.name.localeCompare(b.name))[0];
  const lines = [
    `${summary.assigned} empresas asignadas. ${summary.awaitingReview} movimientos esperan revisión y ${summary.pendingReceipts} no tienen comprobante.`,
    busiest ? `${busiest.name} concentra ${busiest.awaitingReview} movimientos por revisar.` : "No hay empresas asignadas.",
    summary.duplicates === 0 ? "No hay comprobantes duplicados en las empresas asignadas." : `Hay ${summary.duplicates} comprobantes duplicados en las empresas asignadas.`,
    summary.clarifications === 0 ? "No hay aclaraciones abiertas." : `Hay ${summary.clarifications} aclaraciones abiertas.`,
  ];
  const cards = [
    ["Empresas asignadas", summary.assigned, <Building2 className="size-4" key="a" />],
    ["Por revisar", summary.awaitingReview, <ClipboardList className="size-4" key="b" />],
    ["Comprobantes faltantes", summary.pendingReceipts, <FileWarning className="size-4" key="c" />],
    ["Aclaraciones", summary.clarifications, <MessageSquare className="size-4" key="d" />],
    ["Listas para aprobar", summary.readyToApprove, <CheckCheck className="size-4" key="e" />],
    ["Duplicados", summary.duplicates, <Copy className="size-4" key="f" />],
  ] as const;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Buenos días, {greetingName(name)}.</h1>
        <p className="mt-1 text-sm text-slate-500">Prioridades contadas en los movimientos de las empresas asignadas.</p>
      </div>
      <InsightStrip lines={lines} testId="firma-reading" />
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label, value, icon]) => (
            <article key={label} className="rounded-2xl border border-border bg-white p-3">
              <p className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            </article>
          ))}
        </div>
        <article className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm font-semibold">Por revisar</h2>
          <Sparkline points={summary.companies.map((company) => company.awaitingReview)} color="#2563eb" />
          <p className="text-xs text-slate-500">Una marca por empresa, en orden alfabético. No es una serie de tiempo.</p>
          <div className="mt-3">
            <Bars rows={summary.companies.map((company) => ({ label: company.name, value: company.awaitingReview, hint: String(company.awaitingReview) }))} />
          </div>
        </article>
      </section>
      <form action="/firma">
        <Input name="q" defaultValue={q} placeholder="Buscar empresa" />
      </form>
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


import { COMPANY, TX } from "@/lib/ids";
import type { Db } from "@/server/db";

const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);

type PartySeed = { id: string; companyId: string; name: string; kind: "client" | "vendor" };
type InvoiceSeed = {
  id: string;
  companyId: string;
  partyId: string;
  number: string;
  direction: "receivable" | "payable";
  issuedOn: string;
  dueOn: string;
  amountCents: number;
  transactionId?: string;
  approval?: "por_autorizar" | "autorizada" | "en_proceso";
};

const parties: PartySeed[] = [
  { id: "party_qpl_ruiz", companyId: COMPANY.qpl, name: "Cliente Ruiz", kind: "client" },
  { id: "party_qpl_deposito", companyId: COMPANY.qpl, name: "Depósito de cliente", kind: "client" },
  { id: "party_qpl_andina", companyId: COMPANY.qpl, name: "Logística Andina", kind: "client" },
  { id: "party_qpl_fleet", companyId: COMPANY.qpl, name: "FleetSmarts", kind: "vendor" },
  { id: "party_qpl_napa", companyId: COMPANY.qpl, name: "NAPA Auto Parts", kind: "vendor" },
  { id: "party_qpl_omega", companyId: COMPANY.qpl, name: "Taller Omega", kind: "vendor" },
  { id: "party_riv_garcia", companyId: COMPANY.rivera, name: "Cliente García", kind: "client" },
  { id: "party_riv_sol", companyId: COMPANY.rivera, name: "Obra Sol", kind: "client" },
  { id: "party_riv_home", companyId: COMPANY.rivera, name: "Home Depot", kind: "vendor" },
  { id: "party_riv_shell", companyId: COMPANY.rivera, name: "Shell", kind: "vendor" },
  { id: "party_riv_ace", companyId: COMPANY.rivera, name: "Ace Hardware", kind: "vendor" },
  { id: "party_riv_lima", companyId: COMPANY.rivera, name: "Ferretería Lima", kind: "vendor" },
];

const invoices: InvoiceSeed[] = [
  { id: "inv_ruiz_101", companyId: COMPANY.qpl, partyId: "party_qpl_ruiz", number: "FAC-101", direction: "receivable", issuedOn: "2026-10-02", dueOn: "2026-10-14", amountCents: 125_000, transactionId: "tx_qpl_demo_ruiz" },
  { id: "inv_ruiz_102", companyId: COMPANY.qpl, partyId: "party_qpl_ruiz", number: "FAC-102", direction: "receivable", issuedOn: "2026-10-20", dueOn: "2026-11-05", amountCents: 40_000, approval: "autorizada" },
  { id: "inv_ruiz_103", companyId: COMPANY.qpl, partyId: "party_qpl_ruiz", number: "FAC-103", direction: "receivable", issuedOn: "2026-11-01", dueOn: "2026-11-20", amountCents: 25_000, approval: "en_proceso" },
  { id: "inv_dep_201", companyId: COMPANY.qpl, partyId: "party_qpl_deposito", number: "FAC-201", direction: "receivable", issuedOn: "2026-10-10", dueOn: "2026-10-18", amountCents: 45_000, transactionId: "tx_qpl_demo_deposit" },
  { id: "inv_dep_202", companyId: COMPANY.qpl, partyId: "party_qpl_deposito", number: "FAC-202", direction: "receivable", issuedOn: "2026-10-01", dueOn: "2026-10-10", amountCents: 18_000 },
  { id: "inv_and_301", companyId: COMPANY.qpl, partyId: "party_qpl_andina", number: "FAC-301", direction: "receivable", issuedOn: "2026-11-02", dueOn: "2026-11-25", amountCents: 72_000 },
  { id: "inv_and_302", companyId: COMPANY.qpl, partyId: "party_qpl_andina", number: "FAC-302", direction: "receivable", issuedOn: "2026-10-05", dueOn: "2026-10-20", amountCents: 15_000 },
  { id: "inv_fs_401", companyId: COMPANY.qpl, partyId: "party_qpl_fleet", number: "FAC-401", direction: "payable", issuedOn: "2026-10-01", dueOn: "2026-10-08", amountCents: 21_148, transactionId: TX.fs21148 },
  { id: "inv_fs_402", companyId: COMPANY.qpl, partyId: "party_qpl_fleet", number: "FAC-402", direction: "payable", issuedOn: "2026-10-05", dueOn: "2026-10-12", amountCents: 20_394, approval: "autorizada" },
  { id: "inv_fs_403", companyId: COMPANY.qpl, partyId: "party_qpl_fleet", number: "FAC-403", direction: "payable", issuedOn: "2026-11-01", dueOn: "2026-11-22", amountCents: 9_600, approval: "en_proceso" },
  { id: "inv_napa_501", companyId: COMPANY.qpl, partyId: "party_qpl_napa", number: "FAC-501", direction: "payable", issuedOn: "2026-10-20", dueOn: "2026-10-29", amountCents: 2_750, transactionId: "tx_qpl_demo_napa" },
  { id: "inv_om_601", companyId: COMPANY.qpl, partyId: "party_qpl_omega", number: "FAC-601", direction: "payable", issuedOn: "2026-10-01", dueOn: "2026-10-15", amountCents: 6_400 },
  { id: "inv_om_602", companyId: COMPANY.qpl, partyId: "party_qpl_omega", number: "FAC-602", direction: "payable", issuedOn: "2026-11-10", dueOn: "2026-11-28", amountCents: 2_100 },
  { id: "inv_gar_701", companyId: COMPANY.rivera, partyId: "party_riv_garcia", number: "FAC-701", direction: "receivable", issuedOn: "2026-10-01", dueOn: "2026-10-09", amountCents: 500_000, transactionId: TX.garcia },
  { id: "inv_gar_702", companyId: COMPANY.rivera, partyId: "party_riv_garcia", number: "FAC-702", direction: "receivable", issuedOn: "2026-10-15", dueOn: "2026-11-01", amountCents: 88_000 },
  { id: "inv_sol_801", companyId: COMPANY.rivera, partyId: "party_riv_sol", number: "FAC-801", direction: "receivable", issuedOn: "2026-11-03", dueOn: "2026-11-24", amountCents: 120_000 },
  { id: "inv_hd_901", companyId: COMPANY.rivera, partyId: "party_riv_home", number: "FAC-901", direction: "payable", issuedOn: "2026-10-01", dueOn: "2026-10-06", amountCents: 34_218, transactionId: TX.homeDepot },
  { id: "inv_sh_1001", companyId: COMPANY.rivera, partyId: "party_riv_shell", number: "FAC-1001", direction: "payable", issuedOn: "2026-10-08", dueOn: "2026-10-14", amountCents: 8_640, transactionId: TX.shell },
  { id: "inv_ace_1101", companyId: COMPANY.rivera, partyId: "party_riv_ace", number: "FAC-1101", direction: "payable", issuedOn: "2026-10-15", dueOn: "2026-10-21", amountCents: 4_599 },
  { id: "inv_lim_1201", companyId: COMPANY.rivera, partyId: "party_riv_lima", number: "FAC-1201", direction: "payable", issuedOn: "2026-10-02", dueOn: "2026-10-12", amountCents: 22_000 },
];

export async function seedInvoices(db: Db) {
  for (const party of parties) {
    await db.party.upsert({
      where: { id: party.id },
      update: { name: party.name, kind: party.kind, isDemonstration: true },
      create: { ...party, isDemonstration: true },
    });
  }
  for (const invoice of invoices) {
    const linked = Boolean(invoice.transactionId);
    await db.invoice.upsert({
      where: { id: invoice.id },
      update: {
        number: invoice.number,
        issuedOn: noon(invoice.issuedOn),
        dueOn: noon(invoice.dueOn),
        amountCents: invoice.amountCents,
        isDemonstration: true,
      },
      create: {
        id: invoice.id,
        companyId: invoice.companyId,
        partyId: invoice.partyId,
        number: invoice.number,
        direction: invoice.direction,
        issuedOn: noon(invoice.issuedOn),
        dueOn: noon(invoice.dueOn),
        amountCents: invoice.amountCents,
        currency: "USD",
        status: linked ? "matched" : "open",
        approval: linked ? "conciliada" : (invoice.approval ?? "por_autorizar"),
        isDemonstration: true,
      },
    });
    if (!invoice.transactionId) continue;
    await db.invoiceLink.upsert({
      where: { invoiceId_transactionId: { invoiceId: invoice.id, transactionId: invoice.transactionId } },
      update: { status: "confirmed" },
      create: {
        id: `ilink_${invoice.id}`,
        invoiceId: invoice.id,
        transactionId: invoice.transactionId,
        status: "confirmed",
        confirmedAt: noon(invoice.dueOn),
      },
    });
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "matched" } });
  }
}

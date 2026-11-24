import { COMPANY, USER } from "@/lib/ids";
import type { Db } from "@/server/db";

const EXTRA_CATEGORIES: [string, string, string, string][] = [
  ["cat_qpl_renta", COMPANY.qpl, "cat_qpl_administracion", "Renta y servicios"],
  ["cat_qpl_nomina", COMPANY.qpl, "cat_qpl_administracion", "Nómina"],
  ["cat_qpl_seguros", COMPANY.qpl, "cat_qpl_operacion", "Seguros"],
  ["cat_qpl_diesel", COMPANY.qpl, "cat_qpl_transporte", "Diésel"],
  ["cat_qpl_unidades", COMPANY.qpl, "cat_qpl_transporte", "Mantenimiento de unidades"],
  ["cat_qpl_hospedaje", COMPANY.qpl, "cat_qpl_transporte", "Hospedaje"],
  ["cat_qpl_refacciones", COMPANY.qpl, "cat_qpl_operacion", "Refacciones"],
  ["cat_qpl_oficina", COMPANY.qpl, "cat_qpl_administracion", "Oficina"],
  ["cat_qpl_fletes", COMPANY.qpl, "cat_qpl_ingresos", "Fletes"],
  ["cat_riv_renta", COMPANY.rivera, "cat_riv_administracion", "Renta y servicios"],
  ["cat_riv_nomina", COMPANY.rivera, "cat_riv_administracion", "Nómina"],
  ["cat_riv_seguros", COMPANY.rivera, "cat_riv_operacion", "Seguros"],
  ["cat_riv_diesel", COMPANY.rivera, "cat_riv_transporte", "Diésel"],
  ["cat_riv_unidades", COMPANY.rivera, "cat_riv_transporte", "Mantenimiento de unidades"],
  ["cat_riv_hospedaje", COMPANY.rivera, "cat_riv_transporte", "Hospedaje"],
  ["cat_riv_refacciones", COMPANY.rivera, "cat_riv_operacion", "Refacciones"],
  ["cat_riv_materiales", COMPANY.rivera, "cat_riv_operacion", "Materiales"],
  ["cat_riv_oficina", COMPANY.rivera, "cat_riv_administracion", "Oficina"],
  ["cat_riv_obras", COMPANY.rivera, "cat_riv_ingresos", "Obras"],
];

type FixedRow = {
  id: string;
  companyId: string;
  name: string;
  vendor: string;
  matchHint: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  accountId: string | null;
  subcategoryId: string;
};

const FIXED: FixedRow[] = [
  { id: "fx_qpl_renta", companyId: COMPANY.qpl, name: "Renta del patio de camiones", vendor: "Miami Truck Yard", matchHint: "truck yard", amountCents: 250_000, dueDay: 1, frequency: "monthly", accountId: "acct_qpl_chase", subcategoryId: "cat_qpl_renta" },
  { id: "fx_qpl_seguro", companyId: COMPANY.qpl, name: "Seguro de flotilla", vendor: "State Farm", matchHint: "state farm", amountCents: 98_000, dueDay: 5, frequency: "monthly", accountId: "acct_qpl_wells", subcategoryId: "cat_qpl_seguros" },
  { id: "fx_qpl_leasing", companyId: COMPANY.qpl, name: "Arrendamiento del tractocamión", vendor: "Penske", matchHint: "penske", amountCents: 185_000, dueDay: 10, frequency: "monthly", accountId: "acct_qpl_chase", subcategoryId: "cat_qpl_equipo" },
  { id: "fx_qpl_luz", companyId: COMPANY.qpl, name: "Luz del patio", vendor: "FPL", matchHint: "fpl", amountCents: 64_000, dueDay: 8, frequency: "monthly", accountId: "acct_qpl_boa", subcategoryId: "cat_qpl_renta" },
  { id: "fx_qpl_verizon", companyId: COMPANY.qpl, name: "Teléfonos e internet", vendor: "Verizon", matchHint: "verizon", amountCents: 3_120, dueDay: 15, frequency: "monthly", accountId: "acct_qpl_boa", subcategoryId: "cat_qpl_renta" },
  { id: "fx_qpl_web", companyId: COMPANY.qpl, name: "Dominio y página web", vendor: "GoDaddy", matchHint: "godaddy", amountCents: 1_899, dueDay: 18, frequency: "monthly", accountId: "acct_qpl_amex", subcategoryId: "cat_qpl_renta" },
  { id: "fx_qpl_contable", companyId: COMPANY.qpl, name: "Honorarios del despacho contable", vendor: "Despacho Contable", matchHint: "despacho", amountCents: 45_000, dueDay: 20, frequency: "monthly", accountId: "acct_qpl_boa", subcategoryId: "cat_qpl_honorarios" },
  { id: "fx_qpl_nomina", companyId: COMPANY.qpl, name: "Nómina de choferes", vendor: "Gusto", matchHint: "gusto", amountCents: 480_000, dueDay: 30, frequency: "monthly", accountId: "acct_qpl_chase", subcategoryId: "cat_qpl_nomina" },
  { id: "fx_riv_renta", companyId: COMPANY.rivera, name: "Renta de la oficina", vendor: "Coral Gables Offices", matchHint: "coral gables", amountCents: 180_000, dueDay: 1, frequency: "monthly", accountId: "acct_riv_chase", subcategoryId: "cat_riv_renta" },
  { id: "fx_riv_maquinaria", companyId: COMPANY.rivera, name: "Renta de maquinaria", vendor: "United Rentals", matchHint: "united rentals", amountCents: 45_600, dueDay: 10, frequency: "monthly", accountId: "acct_riv_chase", subcategoryId: "cat_riv_equipo" },
  { id: "fx_riv_seguro", companyId: COMPANY.rivera, name: "Seguro de obra", vendor: "Liberty Mutual", matchHint: "liberty", amountCents: 120_000, dueDay: 12, frequency: "monthly", accountId: "acct_riv_chase", subcategoryId: "cat_riv_seguros" },
  { id: "fx_riv_nomina", companyId: COMPANY.rivera, name: "Nómina de cuadrillas", vendor: "ADP", matchHint: "adp", amountCents: 900_000, dueDay: 30, frequency: "monthly", accountId: "acct_riv_chase", subcategoryId: "cat_riv_nomina" },
];

const MANUAL_PAYMENTS: [string, string, string][] = [
  ["fxp_qpl_contable_oct", "fx_qpl_contable", USER.padrino],
  ["fxp_riv_renta_oct", "fx_riv_renta", USER.luis],
];

const SNAPSHOTS: [string, string, number, number, number, [string, number][]][] = [
  [COMPANY.qpl, "2026-08", 398_000, 371_500, 3_258_578, [["Transporte", 151_200], ["Operación", 88_900], ["Administración", 131_400]]],
  [COMPANY.qpl, "2026-09", 431_500, 402_300, 3_287_778, [["Transporte", 168_400], ["Operación", 96_300], ["Administración", 137_600]]],
  [COMPANY.rivera, "2026-08", 540_000, 228_900, 198_082, [["Operación", 129_400], ["Transporte", 34_100], ["Administración", 65_400]]],
  [COMPANY.rivera, "2026-09", 610_000, 245_300, 562_782, [["Operación", 141_800], ["Transporte", 37_500], ["Administración", 66_000]]],
];

export async function seedPlanning(db: Db) {
  for (const [id, companyId, parentId, name] of EXTRA_CATEGORIES) {
    await db.accountingCategory.create({ data: { id, companyId, parentId, name } });
  }
  for (const row of FIXED) {
    await db.fixedExpense.create({ data: row });
  }
  for (const [id, fixedExpenseId, actorId] of MANUAL_PAYMENTS) {
    await db.fixedExpensePayment.create({
      data: { id, fixedExpenseId, period: "2026-10", actorId, paidAt: new Date("2026-10-20T12:00:00.000Z") },
    });
  }
  for (const [companyId, month, inflowsCents, outflowsCents, closingBalanceCents, categories] of SNAPSHOTS) {
    await db.monthSnapshot.create({
      data: {
        id: `snap_${companyId}_${month}`,
        companyId,
        month,
        inflowsCents,
        outflowsCents,
        closingBalanceCents,
        categoriesJson: JSON.stringify(categories.map(([category, totalCents]) => ({ category, totalCents }))),
      },
    });
  }
}

import path from "node:path";
import { ACCOUNT, CAT, COMPANY, FIRM_ID, TX, USER } from "@/lib/ids";
import { MISSING_IDS } from "@/lib/missing-receipts";
import { normalizeMerchant } from "@/lib/matching";
import type { Db } from "@/server/db";
import { sha256 } from "@/server/ids";
import { stampReliableMatcherLinks } from "@/server/domain";
import { seedInvoices } from "@/server/invoice-seed";
import { seedPlanning } from "@/server/planning-seed";

const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);

function store(companyId: string, name: string, bytes: Buffer) {
  return {
    storagePath: path.join("storage", "demo", companyId, name),
    fileHash: sha256(bytes),
    sizeBytes: bytes.byteLength,
  };
}

async function categories(
  db: Db,
  companyId: string,
  ids: {
    transporte: string;
    combustible: string;
    peajes: string;
    ingresos: string;
    servicios: string;
    operacion: string;
    mantenimiento: string;
    equipo: string;
    administracion: string;
    honorarios: string;
  },
) {
  const rows: [string, string | null, string][] = [
    [ids.transporte, null, "Transporte"],
    [ids.combustible, ids.transporte, "Combustible"],
    [ids.peajes, ids.transporte, "Peajes"],
    [ids.ingresos, null, "Ingresos"],
    [ids.servicios, ids.ingresos, "Servicios"],
    [ids.operacion, null, "Operación"],
    [ids.mantenimiento, ids.operacion, "Mantenimiento"],
    [ids.equipo, ids.operacion, "Equipo y vehículos"],
    [ids.administracion, null, "Administración"],
    [ids.honorarios, ids.administracion, "Honorarios"],
  ];
  for (const [id, parentId, name] of rows) {
    await db.accountingCategory.create({ data: { id, companyId, parentId, name } });
  }
}

const DEMO = "Dato de demostración.";

export const QPL_DEMO_ACCOUNTS = [
  {
    id: "acct_qpl_chase",
    institution: "Chase",
    productName: "Business Complete Checking",
    mask: "7741",
    name: "Business Complete Checking",
    currency: "USD",
    availableBalanceCents: 1_862_500,
    kind: "bank",
    isDemonstration: true,
  },
  {
    id: "acct_qpl_wells",
    institution: "Wells Fargo",
    productName: "Navigate Business Checking",
    mask: "2204",
    name: "Navigate Business Checking",
    currency: "USD",
    availableBalanceCents: 640_075,
    kind: "bank",
    isDemonstration: true,
  },
  {
    id: "acct_qpl_amex",
    institution: "American Express",
    productName: "Business Gold Card",
    mask: "1005",
    name: "Tarjeta de crédito Business Gold",
    currency: "USD",
    availableBalanceCents: 420_000,
    kind: "card",
    isDemonstration: true,
  },
] as const;

export const QPL_DEMO_TRANSACTIONS = [
  ["tx_qpl_demo_pilot", "acct_qpl_chase", "2026-10-06", "Pilot Flying J", -6420],
  ["tx_qpl_demo_ruiz", "acct_qpl_chase", "2026-10-14", "Cliente Ruiz", 125_000],
  ["tx_qpl_demo_sams", "acct_qpl_chase", "2026-10-26", "Sam's Club", -3890],
  ["tx_qpl_demo_insurance", "acct_qpl_wells", "2026-10-04", "State Farm", -98_000],
  ["tx_qpl_demo_deposit", "acct_qpl_wells", "2026-10-18", "Depósito de cliente", 45_000],
  ["tx_qpl_demo_napa", "acct_qpl_wells", "2026-10-29", "NAPA Auto Parts", -2750],
  ["tx_qpl_demo_shell", "acct_qpl_amex", "2026-10-09", "Shell", -5120],
  ["tx_qpl_demo_amazon", "acct_qpl_amex", "2026-10-17", "Amazon", -2340],
  ["tx_qpl_demo_payment", "acct_qpl_amex", "2026-10-23", "Pago a la tarjeta", 80_000],
] as const;

export async function insertQplDemonstrationAccounts(db: Db) {
  for (const account of QPL_DEMO_ACCOUNTS) {
    await db.bankAccount.upsert({
      where: { id: account.id },
      update: {},
      create: { ...account, companyId: COMPANY.qpl },
    });
  }
  for (const [id, accountId, day, merchant, amountCents] of QPL_DEMO_TRANSACTIONS) {
    await db.bankTransaction.upsert({
      where: { id },
      update: {},
      create: {
        id,
        companyId: COMPANY.qpl,
        accountId,
        postedOn: noon(day),
        merchant,
        description: DEMO,
        amountCents,
        currency: "USD",
        bankState: "Posted",
        reconciliationState: "Unreconciled",
        documentState: "Missing",
        accountingState: "Uncategorized",
        reviewState: "NeedsReview",
        externalId: id,
        isDemonstration: true,
      },
    });
  }
}

const EXTRA_QPL_TX: [string, string, string, string, number][] = [
  ["tx_qpl_x01", "acct_qpl_boa", "2026-10-02", "RaceTrac", -4215],
  ["tx_qpl_x02", "acct_qpl_boa", "2026-10-05", "Office Depot", -8930],
  ["tx_qpl_x03", "acct_qpl_boa", "2026-10-07", "Cobro cliente Andina", 72000],
  ["tx_qpl_x04", "acct_qpl_boa", "2026-10-11", "TA Travel Center", -7650],
  ["tx_qpl_x05", "acct_qpl_boa", "2026-10-16", "Verizon", -3120],
  ["tx_qpl_x06", "acct_qpl_boa", "2026-10-24", "Love's", -5890],
  ["tx_qpl_x07", "acct_qpl_boa", "2026-10-28", "Cobro cliente Ruiz", 40000],
  ["tx_qpl_x08", "acct_qpl_chase", "2026-10-03", "AutoZone", -6240],
  ["tx_qpl_x09", "acct_qpl_chase", "2026-10-12", "Walmart", -4310],
  ["tx_qpl_x10", "acct_qpl_chase", "2026-10-19", "Depósito en efectivo", 60000],
  ["tx_qpl_x11", "acct_qpl_chase", "2026-10-25", "Comfort Inn", -11280],
  ["tx_qpl_x12", "acct_qpl_wells", "2026-10-06", "Pep Boys", -3980],
  ["tx_qpl_x13", "acct_qpl_wells", "2026-10-13", "FedEx", -2460],
  ["tx_qpl_x14", "acct_qpl_wells", "2026-10-21", "Cobro cliente Andina", 30000],
  ["tx_qpl_x15", "acct_qpl_amex", "2026-10-08", "Costco", -9120],
  ["tx_qpl_x16", "acct_qpl_amex", "2026-10-18", "GoDaddy", -1899],
  ["tx_qpl_x17", "acct_qpl_amex", "2026-10-27", "Flying J", -6730],
];

const EXTRA_RIV_TX: [string, string, string, number][] = [
  ["tx_riv_x01", "2026-10-03", "Lowe's", -28940],
  ["tx_riv_x02", "2026-10-07", "Anticipo Obra Sol", 300000],
  ["tx_riv_x03", "2026-10-10", "United Rentals", -45600],
  ["tx_riv_x04", "2026-10-13", "Sherwin-Williams", -12380],
  ["tx_riv_x05", "2026-10-17", "Ferretería Lima", -22000],
  ["tx_riv_x06", "2026-10-20", "Cobro Obra Sol", 120000],
  ["tx_riv_x07", "2026-10-24", "Sunbelt Rentals", -33750],
  ["tx_riv_x08", "2026-10-28", "Grainger", -8640],
];

const EXTRA_TICKETS: [string, string, string, string, number][] = [
  ["doc_x_racetrac", COMPANY.qpl, "RaceTrac", "RaceTrac_1002.jpg", 4215],
  ["doc_x_officedepot", COMPANY.qpl, "Office Depot", "OfficeDepot_1005.jpg", 8930],
  ["doc_x_ta", COMPANY.qpl, "TA Travel Center", "TA_1011.jpg", 7650],
  ["doc_x_verizon", COMPANY.qpl, "Verizon", "Verizon_1016.jpg", 3120],
  ["doc_x_loves", COMPANY.qpl, "Love's", "Loves_1024.jpg", 5890],
  ["doc_x_autozone", COMPANY.qpl, "AutoZone", "AutoZone_1003.jpg", 6240],
  ["doc_x_walmart", COMPANY.qpl, "Walmart", "Walmart_1012.jpg", 4310],
  ["doc_x_comfort", COMPANY.qpl, "Comfort Inn", "ComfortInn_1025.jpg", 11280],
  ["doc_x_pepboys", COMPANY.qpl, "Pep Boys", "PepBoys_1006.jpg", 3980],
  ["doc_x_fedex", COMPANY.qpl, "FedEx", "FedEx_1013.jpg", 2460],
  ["doc_x_costco", COMPANY.qpl, "Costco", "Costco_1008.jpg", 9120],
  ["doc_x_godaddy", COMPANY.qpl, "GoDaddy", "GoDaddy_1018.jpg", 1899],
  ["doc_x_flyingj", COMPANY.qpl, "Flying J", "FlyingJ_1027.jpg", 6730],
  ["doc_x_lowes", COMPANY.rivera, "Lowe's", "Lowes_1003.jpg", 28940],
  ["doc_x_united", COMPANY.rivera, "United Rentals", "UnitedRentals_1010.jpg", 45600],
  ["doc_x_sherwin", COMPANY.rivera, "Sherwin-Williams", "Sherwin_1013.jpg", 12380],
  ["doc_x_lima", COMPANY.rivera, "Ferretería Lima", "Lima_1017.jpg", 22000],
  ["doc_x_sunbelt", COMPANY.rivera, "Sunbelt Rentals", "Sunbelt_1024.jpg", 33750],
  ["doc_x_grainger", COMPANY.rivera, "Grainger", "Grainger_1028.jpg", 8640],
];

export async function insertExtraDemo(db: Db) {
  for (const [id, accountId, day, merchant, amountCents] of EXTRA_QPL_TX) {
    await db.bankTransaction.create({
      data: {
        id,
        companyId: COMPANY.qpl,
        accountId,
        postedOn: noon(day),
        merchant,
        description: DEMO,
        amountCents,
        currency: "USD",
        bankState: "Posted",
        reconciliationState: "Unreconciled",
        documentState: "Missing",
        accountingState: "Uncategorized",
        reviewState: "NeedsReview",
        externalId: id,
        isDemonstration: true,
      },
    });
  }
  for (const [id, day, merchant, amountCents] of EXTRA_RIV_TX) {
    await db.bankTransaction.create({
      data: {
        id,
        companyId: COMPANY.rivera,
        accountId: ACCOUNT.rivera,
        postedOn: noon(day),
        merchant,
        description: DEMO,
        amountCents,
        currency: "USD",
        bankState: "Posted",
        reconciliationState: "Unreconciled",
        documentState: "Missing",
        accountingState: "Uncategorized",
        reviewState: "NeedsReview",
        externalId: id,
        isDemonstration: true,
      },
    });
  }
  for (const [id, companyId, merchant, fileName, amountCents] of EXTRA_TICKETS) {
    const uploader = companyId === COMPANY.qpl ? USER.padrino : USER.luis;
    const file = store(companyId, `${id}.jpg`, Buffer.from(`serbell-lab-${id}`));
    await db.document.create({
      data: { id, companyId, uploadedById: uploader, fileName, mimeType: "image/jpeg", status: "pending", ...file },
    });
    await db.documentExtraction.create({
      data: {
        id: `ext_${id}`,
        documentId: id,
        merchant,
        amountCents,
        currency: "USD",
        occurredOn: noon("2026-10-15"),
        source: "user",
        isDemonstration: true,
        notice: "Comprobante de demostración en espera de conciliación.",
      },
    });
  }
}

const AUTO_MATCHED: {
  tx: string;
  doc: string;
  fileName: string;
  merchant: string;
  amountCents: number;
  day: string;
  categoryId: string;
  subcategoryId: string;
  mask: string;
}[] = [
  { tx: "tx_qpl_demo_napa", doc: "doc_qpl_napa", fileName: "NAPA_1029.jpg", merchant: "NAPA Auto Parts", amountCents: 2750, day: "2026-10-29", categoryId: CAT.qpl.operacion, subcategoryId: CAT.qpl.equipo, mask: "2204" },
  { tx: "tx_qpl_demo_sams", doc: "doc_qpl_sams", fileName: "SamsClub_1026.jpg", merchant: "Sam's Club", amountCents: 3890, day: "2026-10-26", categoryId: CAT.qpl.operacion, subcategoryId: CAT.qpl.mantenimiento, mask: "7741" },
  { tx: "tx_qpl_x02", doc: "doc_qpl_officedepot", fileName: "OfficeDepot_1005.jpg", merchant: "Office Depot", amountCents: 8930, day: "2026-10-05", categoryId: CAT.qpl.operacion, subcategoryId: CAT.qpl.mantenimiento, mask: "3366" },
];

export async function insertAutoMatchedReceipts(db: Db) {
  for (const item of AUTO_MATCHED) {
    const file = store(COMPANY.qpl, `${item.doc}.jpg`, Buffer.from(`serbell-lab-${item.doc}`));
    await db.bankTransaction.update({
      where: { id: item.tx },
      data: {
        documentState: "Linked",
        accountingState: "Proposed",
        reviewState: "NeedsReview",
        description: `CHECKCARD · Tarjeta ····${item.mask}`,
      },
    });
    await db.document.create({
      data: {
        id: item.doc,
        companyId: COMPANY.qpl,
        uploadedById: USER.padrino,
        fileName: item.fileName,
        mimeType: "image/jpeg",
        status: "linked",
        ...file,
        createdAt: noon(item.day),
      },
    });
    await db.documentExtraction.create({
      data: {
        id: `ext_${item.doc}`,
        documentId: item.doc,
        merchant: item.merchant,
        amountCents: item.amountCents,
        currency: "USD",
        occurredOn: noon(item.day),
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        source: "serbell",
        isDemonstration: true,
        notice: "Serbell encontró el comprobante y lo unió al movimiento.",
        verifiedAt: noon(item.day),
        verifiedById: USER.padrino,
      },
    });
    await db.transactionDocumentLink.create({
      data: {
        id: `link_${item.doc}`,
        transactionId: item.tx,
        documentId: item.doc,
        status: "confirmed",
        confirmedById: USER.padrino,
        confirmedAt: noon(item.day),
      },
    });
    await db.transactionClassification.upsert({
      where: { transactionId: item.tx },
      update: { categoryId: item.categoryId, subcategoryId: item.subcategoryId, source: "serbell", state: "Proposed" },
      create: {
        id: `class_${item.tx}`,
        transactionId: item.tx,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        source: "serbell",
        state: "Proposed",
      },
    });
  }
}

const KEEP_OPEN = new Set<string>([
  TX.fs20394,
  TX.sunpass03,
  TX.sunpass27,
  TX.brian,
  TX.ace,
  ...MISSING_IDS,
]);

function purchaseCategory(companyId: string, merchant: string, amountCents: number) {
  const tree = companyId === COMPANY.qpl ? CAT.qpl : CAT.rivera;
  if (amountCents > 0) return { categoryId: tree.ingresos, subcategoryId: tree.servicios };
  const name = merchant.toLowerCase();
  if (/shell|pilot|race|flying|love|travel|fuel|gas|ta /.test(name) || name === "ta travel center") {
    return { categoryId: tree.transporte, subcategoryId: tree.combustible };
  }
  if (/sunpass|peaje/.test(name)) return { categoryId: tree.transporte, subcategoryId: tree.peajes };
  if (/napa|autozone|pep boys|fleet/.test(name)) return { categoryId: tree.operacion, subcategoryId: tree.equipo };
  return { categoryId: tree.operacion, subcategoryId: tree.mantenimiento };
}

function wantsReceipt(merchant: string, description: string) {
  const text = `${merchant} ${description}`;
  return !/zelle|pago a la tarjeta/i.test(text);
}

function ticketName(merchant: string, day: string) {
  const slug = merchant.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "");
  return `${slug}_${day.slice(5, 7)}${day.slice(8, 10)}.jpg`;
}

/** Most card charges already carry the receipt that the checklist joined. */
export async function linkMostReceipts(db: Db, extraSkip: string[] = []) {
  const skip = new Set<string>([...KEEP_OPEN, ...extraSkip]);
  const rows = await db.bankTransaction.findMany({
    include: { account: true, links: true, classification: true },
    orderBy: { postedOn: "asc" },
  });
  const openDocs = await db.document.findMany({
    where: { status: "pending" },
    include: { extraction: true, links: true },
  });
  const used = new Set<string>();

  for (const tx of rows) {
    if (skip.has(tx.id) || tx.links.some((link) => link.status === "confirmed")) continue;
    if (!wantsReceipt(tx.merchant, tx.description)) continue;
    const amount = Math.abs(tx.amountCents);
    const merchant = normalizeMerchant(tx.merchant);
    const day = tx.postedOn.toISOString().slice(0, 10);
    const ready = openDocs.find((doc) => {
      if (used.has(doc.id) || doc.companyId !== tx.companyId || doc.links.some((link) => link.status === "confirmed")) return false;
      const extracted = doc.extraction;
      if (!extracted?.merchant || extracted.amountCents == null) return false;
      return normalizeMerchant(extracted.merchant) === merchant && Math.abs(extracted.amountCents) === amount;
    });
    const category = purchaseCategory(tx.companyId, tx.merchant, tx.amountCents);
    const actorId = tx.companyId === COMPANY.qpl ? USER.padrino : USER.luis;
    let documentId = ready?.id;
    if (ready) {
      used.add(ready.id);
      await db.document.update({ where: { id: ready.id }, data: { status: "linked" } });
      await db.documentExtraction.update({
        where: { documentId: ready.id },
        data: {
          occurredOn: tx.postedOn,
          categoryId: category.categoryId,
          subcategoryId: category.subcategoryId,
          verifiedAt: noon("2026-10-29"),
          verifiedById: actorId,
          notice: "Serbell encontró el comprobante y lo unió al movimiento.",
        },
      });
    } else {
      documentId = `doc_m_${tx.id.replace(/^tx_/, "")}`;
      const file = store(tx.companyId, `${documentId}.jpg`, Buffer.from(`serbell-linked-${tx.id}`));
      await db.document.create({
        data: {
          id: documentId,
          companyId: tx.companyId,
          uploadedById: actorId,
          fileName: ticketName(tx.merchant, day),
          mimeType: "image/jpeg",
          status: "linked",
          ...file,
        },
      });
      await db.documentExtraction.create({
        data: {
          id: `ext_${documentId}`,
          documentId,
          merchant: tx.merchant,
          amountCents: amount,
          currency: "USD",
          occurredOn: tx.postedOn,
          categoryId: category.categoryId,
          subcategoryId: category.subcategoryId,
          source: "serbell",
          verifiedAt: noon("2026-10-29"),
          verifiedById: actorId,
          isDemonstration: true,
          notice: "Coincide con el movimiento del banco.",
        },
      });
    }
    if (!documentId) continue;
    await db.transactionDocumentLink.create({
      data: {
        id: `link_m_${tx.id.replace(/^tx_/, "")}`,
        transactionId: tx.id,
        documentId,
        status: "confirmed",
        confirmedById: actorId,
        confirmedAt: noon("2026-10-29"),
      },
    });
    await db.bankTransaction.update({
      where: { id: tx.id },
      data: {
        documentState: "Linked",
        ...(tx.amountCents < 0 ? { description: `CHECKCARD · Tarjeta ····${tx.account.mask}` } : {}),
        ...(tx.accountingState === "Uncategorized" ? { accountingState: "Proposed" } : {}),
      },
    });
    if (!tx.classification) {
      await db.transactionClassification.create({
        data: {
          id: `class_${tx.id}`,
          transactionId: tx.id,
          categoryId: category.categoryId,
          subcategoryId: category.subcategoryId,
          source: "serbell",
          state: "Proposed",
        },
      });
    }
  }
}

export async function seedDatabase(db: Db) {
  await db.accountingFirm.create({
    data: { id: FIRM_ID, name: "Despacho Contable" },
  });
  await db.user.createMany({
    data: [
      { id: USER.padrino, name: "Padrino", email: "padrino@quickpick.example" },
      { id: USER.luis, name: "Luis Rivera", email: "luis.rivera@rivera.example" },
      { id: USER.carlos, name: "Carlos Ruiz", email: "carlos.ruiz@despacho.example" },
      { id: USER.ana, name: "Ana Martínez", email: "ana.martinez@despacho.example" },
    ],
  });
  await db.firmMembership.createMany({
    data: [
      { id: "fm_carlos", firmId: FIRM_ID, userId: USER.carlos, role: "ACCOUNTANT" },
      { id: "fm_ana", firmId: FIRM_ID, userId: USER.ana, role: "FIRM_ADMIN" },
    ],
  });
  await db.company.createMany({
    data: [
      { id: COMPANY.qpl, firmId: FIRM_ID, name: "Quick Pick Logistics", industry: "Transporte y logística" },
      { id: COMPANY.rivera, firmId: FIRM_ID, name: "Rivera Construction", industry: "Construcción" },
    ],
  });
  await db.companyMembership.createMany({
    data: [
      { id: "cm_padrino", companyId: COMPANY.qpl, userId: USER.padrino, role: "BUSINESS_OWNER" },
      { id: "cm_luis", companyId: COMPANY.rivera, userId: USER.luis, role: "BUSINESS_OWNER" },
      { id: "cm_carlos_qpl", companyId: COMPANY.qpl, userId: USER.carlos, role: "ACCOUNTANT" },
      { id: "cm_carlos_riv", companyId: COMPANY.rivera, userId: USER.carlos, role: "ACCOUNTANT" },
      { id: "cm_ana_qpl", companyId: COMPANY.qpl, userId: USER.ana, role: "FIRM_ADMIN" },
      { id: "cm_ana_riv", companyId: COMPANY.rivera, userId: USER.ana, role: "FIRM_ADMIN" },
    ],
  });
  await db.bankAccount.createMany({
    data: [
      {
        id: ACCOUNT.qpl,
        companyId: COMPANY.qpl,
        institution: "Bank of America",
        productName: "Business Advantage Fundamentals",
        mask: "3366",
        name: "Business Advantage Fundamentals",
        currency: "USD",
        availableBalanceCents: 414049,
      },
      {
        id: ACCOUNT.rivera,
        companyId: COMPANY.rivera,
        institution: "Chase",
        productName: "Business Complete Checking",
        mask: "2290",
        name: "Business Complete Checking",
        currency: "USD",
        availableBalanceCents: 1284015,
      },
    ],
  });
  await categories(db, COMPANY.qpl, CAT.qpl);
  await categories(db, COMPANY.rivera, CAT.rivera);

  const qplTx = [
    [TX.fs20394, "2026-10-12", "FleetSmarts", "CHECKCARD 1010 · Tarjeta ····3366", -20394, "Missing", "Proposed", "NeedsReview"],
    [TX.fs21148, "2026-10-08", "FleetSmarts", "CHECKCARD 1008 · Tarjeta ····3366", -21148, "Linked", "Approved", "Approved"],
    [TX.income200, "2026-10-15", "Quick Pick Logistics", "Zelle recibido", 20000, "Missing", "Proposed", "NeedsReview"],
    [TX.sunpass03, "2026-10-03", "SunPass", "CHECKCARD 1011 · Tarjeta ····3366", -1000, "Suggested", "Proposed", "NeedsReview"],
    [TX.carlosDavid, "2026-10-20", "Carlos David", "Zelle enviado", -21500, "Missing", "Proposed", "NeedsReview"],
    [TX.fs15012, "2026-10-22", "FleetSmarts", "CHECKCARD 1010 · Tarjeta ····3366", -15012, "Linked", "Approved", "Approved"],
    [TX.sunpass27, "2026-10-27", "SunPass", "CHECKCARD 1010 · Tarjeta ····3366", -1000, "Suggested", "Proposed", "NeedsReview"],
    [TX.brian, "2026-10-18", "Brian", "Zelle enviado", -148756, "Missing", "Uncategorized", "NeedsClient"],
  ] as const;
  for (const [id, day, merchant, description, amountCents, documentState, accountingState, reviewState] of qplTx) {
    await db.bankTransaction.create({
      data: {
        id,
        companyId: COMPANY.qpl,
        accountId: ACCOUNT.qpl,
        postedOn: noon(day),
        merchant,
        description,
        amountCents,
        currency: "USD",
        bankState: "Posted",
        reconciliationState: "Unreconciled",
        documentState,
        accountingState,
        reviewState,
        externalId: id,
        sealedAt: id === TX.fs15012 ? noon("2026-10-23") : null,
        sealedById: id === TX.fs15012 ? USER.carlos : null,
      },
    });
  }
  const classRows = [
    [TX.fs20394, CAT.qpl.transporte, CAT.qpl.combustible, "Proposed"],
    [TX.fs21148, CAT.qpl.transporte, CAT.qpl.combustible, "Approved"],
    [TX.income200, CAT.qpl.ingresos, CAT.qpl.servicios, "Proposed"],
    [TX.sunpass03, CAT.qpl.transporte, CAT.qpl.peajes, "Proposed"],
    [TX.carlosDavid, CAT.qpl.operacion, CAT.qpl.equipo, "Proposed"],
    [TX.fs15012, CAT.qpl.transporte, CAT.qpl.combustible, "Approved"],
    [TX.sunpass27, CAT.qpl.transporte, CAT.qpl.peajes, "Proposed"],
  ] as const;
  for (const [transactionId, categoryId, subcategoryId, state] of classRows) {
    await db.transactionClassification.create({
      data: { id: `class_${transactionId}`, transactionId, categoryId, subcategoryId, source: "seed", state },
    });
  }

  const rivTx = [
    [TX.homeDepot, "2026-10-06", "Home Depot", "Compra de materiales", -34218, "Missing", "Proposed", "NeedsReview"],
    [TX.garcia, "2026-10-09", "Cliente García", "Pago de cliente", 500000, "Missing", "Proposed", "NeedsReview"],
    [TX.shell, "2026-10-14", "Shell", "Combustible de cuadrilla", -8640, "Linked", "Approved", "Approved"],
    [TX.ace, "2026-10-21", "Ace Hardware", "Compra de ferretería", -4599, "Conflict", "Uncategorized", "NeedsReview"],
  ] as const;
  for (const [id, day, merchant, description, amountCents, documentState, accountingState, reviewState] of rivTx) {
    await db.bankTransaction.create({
      data: {
        id,
        companyId: COMPANY.rivera,
        accountId: ACCOUNT.rivera,
        postedOn: noon(day),
        merchant,
        description,
        amountCents,
        currency: "USD",
        bankState: "Posted",
        reconciliationState: "Unreconciled",
        documentState,
        accountingState,
        reviewState,
        externalId: id,
      },
    });
  }

  const receipt21148 = Buffer.from("serbell-lab-receipt-fleetsmarts-21148");
  const receipt15012 = Buffer.from("serbell-lab-receipt-fleetsmarts-15012");
  const receiptSun = Buffer.from("serbell-lab-receipt-sunpass");
  const receiptHarbor = Buffer.from("serbell-lab-receipt-harbor");
  const receiptShell = Buffer.from("serbell-lab-receipt-shell");
  const receiptAce = Buffer.from("serbell-lab-receipt-ace");
  const receiptAceConflict = Buffer.from("serbell-lab-receipt-ace-conflict");
  const file21148 = store(COMPANY.qpl, "doc_qpl_fs_21148.jpg", receipt21148);
  const fileDup = store(COMPANY.qpl, "doc_qpl_dup_21148.jpg", receipt21148);
  const file15012 = store(COMPANY.qpl, "doc_qpl_fs_15012.jpg", receipt15012);
  const fileSun = store(COMPANY.qpl, "doc_qpl_sunpass.jpg", receiptSun);
  const fileHarbor = store(COMPANY.qpl, "doc_qpl_harbor.jpg", receiptHarbor);
  const fileShell = store(COMPANY.rivera, "doc_riv_shell.jpg", receiptShell);
  const fileAce = store(COMPANY.rivera, "doc_riv_ace.jpg", receiptAce);
  const fileAceBad = store(COMPANY.rivera, "doc_riv_ace_conflict.jpg", receiptAceConflict);

  await db.document.createMany({
    data: [
      { id: "doc_qpl_fs_21148", companyId: COMPANY.qpl, uploadedById: USER.padrino, fileName: "FleetSmarts_21148.jpg", mimeType: "image/jpeg", status: "linked", ...file21148, createdAt: noon("2026-10-08") },
      { id: "doc_qpl_fs_15012", companyId: COMPANY.qpl, uploadedById: USER.padrino, fileName: "FleetSmarts_15012.jpg", mimeType: "image/jpeg", status: "linked", ...file15012, createdAt: noon("2026-10-22") },
      { id: "doc_qpl_sunpass", companyId: COMPANY.qpl, uploadedById: USER.padrino, fileName: "SunPass.jpg", mimeType: "image/jpeg", status: "suggested", ...fileSun, createdAt: noon("2026-10-04") },
      { id: "doc_qpl_harbor", companyId: COMPANY.qpl, uploadedById: USER.padrino, fileName: "HarborFreight.jpg", mimeType: "image/jpeg", status: "pending", ...fileHarbor, createdAt: noon("2026-10-11") },
      { id: "doc_riv_shell", companyId: COMPANY.rivera, uploadedById: USER.luis, fileName: "Shell.jpg", mimeType: "image/jpeg", status: "linked", ...fileShell, createdAt: noon("2026-10-14") },
      { id: "doc_riv_ace", companyId: COMPANY.rivera, uploadedById: USER.luis, fileName: "AceHardware.jpg", mimeType: "image/jpeg", status: "linked", ...fileAce, createdAt: noon("2026-10-21") },
      { id: "doc_riv_ace_conflict", companyId: COMPANY.rivera, uploadedById: USER.luis, fileName: "AceHardware_otro.jpg", mimeType: "image/jpeg", status: "conflict", ...fileAceBad, createdAt: noon("2026-10-21") },
    ],
  });
  await db.documentExtraction.createMany({
    data: [
      { id: "ext_21148", documentId: "doc_qpl_fs_21148", merchant: "FleetSmarts", amountCents: 21148, currency: "USD", occurredOn: noon("2026-10-08"), categoryId: CAT.qpl.transporte, subcategoryId: CAT.qpl.combustible, source: "user", isDemonstration: false, notice: "Datos capturados en la semilla de demostración.", verifiedAt: noon("2026-10-08"), verifiedById: USER.padrino },
      { id: "ext_15012", documentId: "doc_qpl_fs_15012", merchant: "FleetSmarts", amountCents: 15012, currency: "USD", occurredOn: noon("2026-10-22"), categoryId: CAT.qpl.transporte, subcategoryId: CAT.qpl.combustible, source: "user", isDemonstration: false, notice: "Datos capturados en la semilla de demostración.", verifiedAt: noon("2026-10-22"), verifiedById: USER.padrino },
      { id: "ext_sun", documentId: "doc_qpl_sunpass", merchant: "SunPass", amountCents: 1000, currency: "USD", occurredOn: null, categoryId: CAT.qpl.transporte, subcategoryId: CAT.qpl.peajes, source: "user", isDemonstration: false, notice: "Hay dos movimientos SunPass por el mismo importe. La fecha no vino en el comprobante.", verifiedAt: noon("2026-10-04"), verifiedById: USER.padrino },
      { id: "ext_harbor", documentId: "doc_qpl_harbor", merchant: "Harbor Freight", amountCents: 8900, currency: "USD", occurredOn: noon("2026-10-11"), source: "user", isDemonstration: false, notice: "No hay un movimiento bancario con este comercio e importe.", verifiedAt: noon("2026-10-11"), verifiedById: USER.padrino },
      { id: "ext_shell", documentId: "doc_riv_shell", merchant: "Shell", amountCents: 8640, currency: "USD", occurredOn: noon("2026-10-14"), categoryId: CAT.rivera.transporte, subcategoryId: CAT.rivera.combustible, source: "user", isDemonstration: false, notice: "Datos capturados en la semilla de demostración.", verifiedAt: noon("2026-10-14"), verifiedById: USER.luis },
      { id: "ext_ace", documentId: "doc_riv_ace", merchant: "Ace Hardware", amountCents: 4599, currency: "USD", occurredOn: noon("2026-10-21"), source: "user", isDemonstration: false, notice: "Comprobante vinculado.", verifiedAt: noon("2026-10-21"), verifiedById: USER.luis },
      { id: "ext_ace_bad", documentId: "doc_riv_ace_conflict", merchant: "Ace Hardware", amountCents: 4599, currency: "USD", occurredOn: noon("2026-10-21"), source: "user", isDemonstration: false, notice: "Otro comprobante del mismo comercio, importe y fecha. El movimiento ya tiene vínculo, así que no se reasigna.", verifiedAt: noon("2026-10-21"), verifiedById: USER.luis },
    ],
  });
  await db.document.create({
    data: {
      id: "doc_qpl_dup_21148",
      companyId: COMPANY.qpl,
      uploadedById: USER.padrino,
      fileName: "FleetSmarts_21148_copia.jpg",
      mimeType: "image/jpeg",
      status: "duplicate",
      duplicateOfId: "doc_qpl_fs_21148",
      ...fileDup,
      createdAt: noon("2026-10-09"),
    },
  });
  await db.documentExtraction.create({
    data: {
      id: "ext_dup",
      documentId: "doc_qpl_dup_21148",
      merchant: "FleetSmarts",
      amountCents: 21148,
      currency: "USD",
      occurredOn: noon("2026-10-08"),
      source: "user",
      isDemonstration: false,
      notice: "Duplicado del comprobante ya vinculado.",
      verifiedAt: noon("2026-10-09"),
      verifiedById: USER.padrino,
    },
  });
  await db.transactionDocumentLink.createMany({
    data: [
      { id: "link_21148", transactionId: TX.fs21148, documentId: "doc_qpl_fs_21148", status: "confirmed", confirmedById: USER.padrino, confirmedAt: noon("2026-10-08") },
      { id: "link_15012", transactionId: TX.fs15012, documentId: "doc_qpl_fs_15012", status: "confirmed", confirmedById: USER.carlos, confirmedAt: noon("2026-10-22") },
      { id: "link_shell", transactionId: TX.shell, documentId: "doc_riv_shell", status: "confirmed", confirmedById: USER.luis, confirmedAt: noon("2026-10-14") },
      { id: "link_ace", transactionId: TX.ace, documentId: "doc_riv_ace", status: "confirmed", confirmedById: USER.luis, confirmedAt: noon("2026-10-21") },
    ],
  });
  await db.matchCandidate.createMany({
    data: [
      { id: "cand_sun_03", documentId: "doc_qpl_sunpass", transactionId: TX.sunpass03, decision: "ambiguous", evidenceJson: "{}", reasonsForJson: JSON.stringify(["El importe coincide exactamente (USD 10.00).", "El comercio es el mismo (SunPass)."]), reasonsAgainstJson: JSON.stringify(["El comprobante no tiene fecha. La comparación usa comercio e importe."]), blocked: false },
      { id: "cand_sun_27", documentId: "doc_qpl_sunpass", transactionId: TX.sunpass27, decision: "ambiguous", evidenceJson: "{}", reasonsForJson: JSON.stringify(["El importe coincide exactamente (USD 10.00).", "El comercio es el mismo (SunPass)."]), reasonsAgainstJson: JSON.stringify(["El comprobante no tiene fecha. La comparación usa comercio e importe."]), blocked: false },
    ],
  });

  await db.transactionClassification.createMany({
    data: [
      { id: "class_riv_home", transactionId: TX.homeDepot, categoryId: CAT.rivera.operacion, subcategoryId: CAT.rivera.mantenimiento, source: "seed", state: "Proposed" },
      { id: "class_riv_garcia", transactionId: TX.garcia, categoryId: CAT.rivera.ingresos, subcategoryId: CAT.rivera.servicios, source: "seed", state: "Proposed" },
      { id: "class_riv_shell", transactionId: TX.shell, categoryId: CAT.rivera.transporte, subcategoryId: CAT.rivera.combustible, source: "seed", state: "Approved" },
    ],
  });

  await db.conversation.createMany({
    data: [
      { id: "conv_qpl", companyId: COMPANY.qpl, title: "Serbell", activeDocumentId: null },
      { id: "conv_rivera", companyId: COMPANY.rivera, title: "Serbell", activeDocumentId: null },
    ],
  });
  await db.message.createMany({
    data: [
      { id: "msg_qpl_hello", conversationId: "conv_qpl", role: "assistant", body: "Puedo guardar comprobantes, buscar coincidencias en los movimientos y dejarte confirmar el vínculo. No cierro el mes ni conecto un banco.", intent: "note" },
      { id: "msg_brian", conversationId: "conv_qpl", authorId: USER.carlos, transactionId: TX.brian, role: "user", body: "Padrino, ¿qué es el pago a Brian de USD 1,487.56?", intent: "clarification" },
      { id: "msg_riv_hello", conversationId: "conv_rivera", role: "assistant", body: "Este es el chat de Rivera Construction. Las acciones quedan guardadas en la base de esta empresa.", intent: "note" },
    ],
  });
  await db.task.createMany({
    data: [
      { id: "task_brian", companyId: COMPANY.qpl, transactionId: TX.brian, kind: "clarification", title: "Aclarar el pago a Brian", status: "open" },
      { id: "task_harbor", companyId: COMPANY.qpl, documentId: "doc_qpl_harbor", kind: "no_match", title: "Comprobante sin movimiento bancario", status: "open" },
    ],
  });
  await db.auditEvent.createMany({
    data: [
      {
        id: "aud_21148",
        companyId: COMPANY.qpl,
        actorId: USER.carlos,
        transactionId: TX.fs21148,
        documentId: "doc_qpl_fs_21148",
        action: "seeded_approval",
        previousJson: JSON.stringify({ reviewState: "NeedsReview" }),
        nextJson: JSON.stringify({ reviewState: "Approved", accountingState: "Approved", sealedAt: null }),
        createdAt: noon("2026-10-10"),
      },
      {
        id: "aud_15012",
        companyId: COMPANY.qpl,
        actorId: USER.carlos,
        transactionId: TX.fs15012,
        documentId: "doc_qpl_fs_15012",
        action: "seeded_seal",
        previousJson: JSON.stringify({ reviewState: "NeedsReview", sealedAt: null, categoryId: CAT.qpl.transporte, subcategoryId: CAT.qpl.combustible }),
        nextJson: JSON.stringify({ reviewState: "Approved", accountingState: "Approved", sealedAt: noon("2026-10-23").toISOString(), documentId: "doc_qpl_fs_15012", categoryId: CAT.qpl.transporte, subcategoryId: CAT.qpl.combustible }),
        createdAt: noon("2026-10-23"),
      },
      {
        id: "aud_dup",
        companyId: COMPANY.qpl,
        actorId: USER.padrino,
        documentId: "doc_qpl_dup_21148",
        action: "duplicate_detected",
        nextJson: JSON.stringify({ duplicateOfId: "doc_qpl_fs_21148" }),
        createdAt: noon("2026-10-09"),
      },
      {
        id: "aud_ace",
        companyId: COMPANY.rivera,
        actorId: USER.carlos,
        transactionId: TX.ace,
        documentId: "doc_riv_ace_conflict",
        action: "match_conflict",
        nextJson: JSON.stringify({ documentState: "Conflict" }),
        justification: "Otro comprobante de Ace Hardware coincide en importe y fecha, pero el movimiento ya tiene un vínculo.",
        createdAt: noon("2026-10-21"),
      },
    ],
  });
  await insertQplDemonstrationAccounts(db);
  await insertExtraDemo(db);
  await insertAutoMatchedReceipts(db);
  await linkMostReceipts(db, ["tx_qpl_demo_pilot"]);
  await stampReliableMatcherLinks(db);
  await linkMostReceipts(db);
  await db.accountingReview.create({
    data: {
      id: "rev_15012",
      transactionId: TX.fs15012,
      actorId: USER.carlos,
      action: "seal",
      previousJson: JSON.stringify({ reviewState: "NeedsReview", sealedAt: null }),
      nextJson: JSON.stringify({ reviewState: "Approved", sealedAt: noon("2026-10-23").toISOString() }),
      createdAt: noon("2026-10-23"),
    },
  });
  await seedInvoices(db);
  await seedPlanning(db);
}

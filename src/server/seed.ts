import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ACCOUNT, CAT, COMPANY, FIRM_ID, TX, USER } from "@/lib/ids";
import type { Db } from "@/server/db";
import { sha256 } from "@/server/ids";
import { stampReliableMatcherLinks } from "@/server/domain";

const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);

async function store(companyId: string, name: string, bytes: Buffer) {
  const storagePath = path.join("storage", "uploads", companyId, name);
  const absolute = path.join(process.cwd(), storagePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  return { storagePath, fileHash: sha256(bytes), sizeBytes: bytes.byteLength };
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
  const file21148 = await store(COMPANY.qpl, "doc_qpl_fs_21148.jpg", receipt21148);
  const fileDup = await store(COMPANY.qpl, "doc_qpl_dup_21148.jpg", receipt21148);
  const file15012 = await store(COMPANY.qpl, "doc_qpl_fs_15012.jpg", receipt15012);
  const fileSun = await store(COMPANY.qpl, "doc_qpl_sunpass.jpg", receiptSun);
  const fileHarbor = await store(COMPANY.qpl, "doc_qpl_harbor.jpg", receiptHarbor);
  const fileShell = await store(COMPANY.rivera, "doc_riv_shell.jpg", receiptShell);
  const fileAce = await store(COMPANY.rivera, "doc_riv_ace.jpg", receiptAce);
  const fileAceBad = await store(COMPANY.rivera, "doc_riv_ace_conflict.jpg", receiptAceConflict);

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
  await stampReliableMatcherLinks(db);
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
}

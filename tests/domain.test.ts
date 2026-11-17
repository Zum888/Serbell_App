import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ACCOUNT, CAT, COMPANY, TX, USER } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import {
  changeClassification,
  confirmExtraction,
  confirmLink,
  postChat,
  saveUploadedDocument,
  reconcileTransaction,
  reconcileTransactions,
  replaceTransactionDocument,
  reopenTransaction,
  saveJournalEntry,
  sealTransaction,
} from "@/server/domain";
import { accountBreakdowns, companyReport, documentBoard, firmQueue, getFirm, getHome, getMovement, loadActor, reviewBoard } from "@/server/queries";
import { seedDatabase } from "@/server/seed";

const databaseUrl = "file:/tmp/serbell-vitest.db";
let prisma: PrismaClient;

beforeAll(async () => {
  rmSync("/tmp/serbell-vitest.db", { force: true });
  execSync("npx prisma db push --skip-generate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await seedDatabase(prisma);
}, 60000);

afterAll(async () => {
  await prisma?.$disconnect();
});

it("vincula el comprobante, el contador sella y el propietario no puede editar", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  const carlos = await loadActor(prisma, USER.carlos);
  const luis = await loadActor(prisma, USER.luis);
  if (!padrino || !carlos || !luis) throw new Error("faltan actores");

  const uploaded = await saveUploadedDocument(prisma, padrino, {
    companyId: COMPANY.qpl,
    fileName: "FleetSmarts_ticket.jpg",
    mimeType: "image/jpeg",
    bytes: Buffer.from("ticket-de-prueba-unico"),
  });
  const extraction = await prisma.documentExtraction.findUnique({ where: { documentId: uploaded.id } });
  expect(extraction?.isDemonstration).toBe(true);
  expect(extraction?.merchant).toBe("FleetSmarts");
  expect(extraction?.amountCents).toBe(20394);

  const match = await confirmExtraction(prisma, padrino, uploaded.id);
  expect(match.decision).toBe("reliable");
  expect(match.proposedTransactionId).toBe(TX.fs20394);

  await confirmLink(prisma, padrino, uploaded.id, TX.fs20394);
  const linked = await prisma.bankTransaction.findUnique({ where: { id: TX.fs20394 } });
  expect(linked?.documentState).toBe("Linked");
  const link = await prisma.transactionDocumentLink.findFirst({
    where: { transactionId: TX.fs20394, documentId: uploaded.id, status: "confirmed" },
  });
  expect(link).not.toBeNull();

  await sealTransaction(prisma, carlos, TX.fs20394);
  const sealed = await prisma.bankTransaction.findUnique({ where: { id: TX.fs20394 } });
  expect(sealed?.reviewState).toBe("Approved");
  expect(sealed?.accountingState).toBe("Approved");
  expect(sealed?.sealedById).toBe(USER.carlos);
  expect(sealed?.sealedAt).toBeTruthy();

  const audit = await prisma.auditEvent.findFirst({
    where: { transactionId: TX.fs20394, action: "seal", actorId: USER.carlos },
  });
  expect(audit?.companyId).toBe(COMPANY.qpl);
  expect(audit?.documentId).toBe(uploaded.id);
  expect(audit?.previousJson).toContain("NeedsReview");
  expect(audit?.nextJson).toContain(CAT.qpl.combustible);

  await expect(
    changeClassification(prisma, padrino, TX.fs20394, { subcategoryId: CAT.qpl.peajes }),
  ).rejects.toMatchObject({ code: "SEALED" });
  await expect(sealTransaction(prisma, padrino, TX.income200)).rejects.toBeInstanceOf(AppError);

  const reloaded = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const persisted = await reloaded.bankTransaction.findUnique({ where: { id: TX.fs20394 } });
  const persistedAudit = await reloaded.auditEvent.findUnique({ where: { id: audit?.id ?? "" } });
  expect(persisted?.sealedAt?.toISOString()).toBe(sealed?.sealedAt?.toISOString());
  expect(persistedAudit?.action).toBe("seal");
  await reloaded.$disconnect();

  await expect(getMovement(prisma, padrino, TX.homeDepot)).rejects.toMatchObject({ code: "COMPANY_FORBIDDEN" });
  await expect(getHome(prisma, luis, COMPANY.qpl)).rejects.toMatchObject({ code: "COMPANY_FORBIDDEN" });

  const home = await getHome(prisma, padrino, COMPANY.qpl);
  const boa = home.accounts.find((account) => account.id === ACCOUNT.qpl);
  expect(boa?.availableBalanceCents).toBe(414049);
  expect(home.accounts).toHaveLength(4);
  expect(home.balanceCents).toBe(3_336_624);
  await prisma.bankAccount.update({ where: { id: ACCOUNT.qpl }, data: { availableBalanceCents: 100 } });
  const changed = await getHome(prisma, padrino, COMPANY.qpl);
  expect(changed.balanceCents).toBe(3_336_624 - 414049 + 100);
  await prisma.bankAccount.update({ where: { id: ACCOUNT.qpl }, data: { availableBalanceCents: 414049 } });
});

it("guarda la corrección del contador sin aplicarla a otro movimiento", async () => {
  const carlos = await loadActor(prisma, USER.carlos);
  if (!carlos) throw new Error("falta Carlos");
  const beforeBrian = await prisma.transactionClassification.findUnique({ where: { transactionId: TX.brian } });
  await changeClassification(prisma, carlos, TX.carlosDavid, {
    subcategoryId: CAT.qpl.honorarios,
    justification: "El pago a Carlos David es un honorario, no equipo.",
  });
  const rule = await prisma.classificationRule.findFirst({
    where: { transactionId: TX.carlosDavid, actorId: USER.carlos },
  });
  expect(rule?.applied).toBe(false);
  expect(rule?.beforeJson).toContain(CAT.qpl.equipo);
  expect(rule?.afterJson).toContain(CAT.qpl.honorarios);
  const fuel = await prisma.transactionClassification.findUnique({ where: { transactionId: TX.fs21148 } });
  expect(fuel?.subcategoryId).toBe(CAT.qpl.combustible);
  const brian = await prisma.transactionClassification.findUnique({ where: { transactionId: TX.brian } });
  expect(brian?.subcategoryId ?? null).toBe(beforeBrian?.subcategoryId ?? null);
});

it("detecta un archivo duplicado y no finge una acción no implementada", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  if (!padrino) throw new Error("falta Padrino");
  const duplicate = await saveUploadedDocument(prisma, padrino, {
    companyId: COMPANY.qpl,
    fileName: "copia.jpg",
    mimeType: "image/jpeg",
    bytes: Buffer.from("serbell-lab-receipt-fleetsmarts-21148"),
  });
  const row = await prisma.document.findUnique({ where: { id: duplicate.id } });
  expect(row?.duplicateOfId).toBe("doc_qpl_fs_21148");
  expect(row?.status).toBe("duplicate");

  const before = await prisma.bankAccount.count();
  const chat = await postChat(prisma, padrino, COMPANY.qpl, "Conecta Plaid y cierra el mes");
  expect(chat.reply).toBe("Esta acción no está implementada.");
  expect(await prisma.bankAccount.count()).toBe(before);
  const status = await postChat(prisma, padrino, COMPANY.qpl, "estado de operaciones");
  expect(status.reply).toContain("Quick Pick Logistics");
  expect(status.reply).toContain("movimientos");
});

it("separa la conciliación manual de la marca del matcher", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  if (!padrino) throw new Error("falta Padrino");
  expect(await prisma.auditEvent.findFirst({ where: { transactionId: TX.fs15012, action: "serbell_matched" } })).not.toBeNull();
  expect(await prisma.auditEvent.findFirst({ where: { transactionId: TX.fs21148, action: "serbell_matched" } })).toBeNull();
  expect(await prisma.auditEvent.findFirst({ where: { transactionId: "tx_qpl_demo_pilot", action: "serbell_matched" } })).toBeNull();

  await reconcileTransaction(prisma, padrino, TX.brian);
  const brian = await prisma.bankTransaction.findUnique({ where: { id: TX.brian } });
  expect(brian?.reconciliationState).toBe("Reconciled");
  expect(brian?.sealedAt).toBeNull();
  const manual = await prisma.auditEvent.findFirst({ where: { transactionId: TX.brian, action: "manual_reconcile" } });
  expect(manual?.actorId).toBe(USER.padrino);
  expect(await prisma.auditEvent.findFirst({ where: { transactionId: TX.brian, action: "serbell_matched" } })).toBeNull();

  const accounts = await accountBreakdowns(prisma, padrino, COMPANY.qpl);
  expect(accounts).toHaveLength(4);
  expect(accounts.some((account) => account.id === ACCOUNT.rivera)).toBe(false);
  expect(accounts.find((account) => account.id === ACCOUNT.qpl)?.availableBalanceCents).toBe(414049);
});

it("suma el reporte con los movimientos guardados de la empresa", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  const luis = await loadActor(prisma, USER.luis);
  if (!padrino || !luis) throw new Error("faltan perfiles");
  const report = await companyReport(prisma, padrino, COMPANY.qpl);
  const rows = await prisma.bankTransaction.findMany({ where: { companyId: COMPANY.qpl } });
  const inflows = rows.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0);
  const outflows = rows.filter((row) => row.amountCents < 0).reduce((sum, row) => sum + Math.abs(row.amountCents), 0);
  expect(report.inflows).toBe(inflows);
  expect(report.outflows).toBe(outflows);
  expect(report.net).toBe(inflows - outflows);
  expect(report.count).toBe(rows.length);
  expect(report.accounts.some((account) => account.id === ACCOUNT.rivera)).toBe(false);
  expect(report.accounts.filter((account) => account.isDemonstration)).toHaveLength(3);
  const most = rows.reduce((left, right) => (left.amountCents < right.amountCents ? left : right));
  expect(report.largestExpenses[0]?.id).toBe(most.id);
  expect(report.duplicates.length).toBeGreaterThan(0);
  await expect(companyReport(prisma, luis, COMPANY.qpl)).rejects.toMatchObject({ code: "COMPANY_FORBIDDEN" });
});

it("guarda el asiento del contador y no deja editar un movimiento sellado", async () => {
  const carlos = await loadActor(prisma, USER.carlos);
  const padrino = await loadActor(prisma, USER.padrino);
  const ana = await loadActor(prisma, USER.ana);
  if (!carlos || !padrino || !ana) throw new Error("faltan perfiles");
  const lines = [
    { accountName: "Combustible", debitCents: 20394, creditCents: 0 },
    { accountName: "Servicios", debitCents: 0, creditCents: 20394 },
  ];
  const input = { subcategoryId: CAT.qpl.combustible, justification: "Asiento del combustible FleetSmarts.", lines };
  await expect(saveJournalEntry(prisma, carlos, TX.fs20394, input)).rejects.toMatchObject({ code: "SEALED" });
  await expect(saveJournalEntry(prisma, padrino, TX.fs20394, input)).rejects.toMatchObject({ code: "SEALED" });
  await expect(saveJournalEntry(prisma, padrino, TX.sunpass03, input)).rejects.toMatchObject({ code: "ASIENTO_FORBIDDEN" });
  await expect(
    saveJournalEntry(prisma, carlos, TX.sunpass03, { ...input, lines: [{ accountName: "Combustible", debitCents: 1000, creditCents: 0 }, { accountName: "Servicios", debitCents: 0, creditCents: 500 }] }),
  ).rejects.toMatchObject({ code: "ASIENTO_UNBALANCED" });
  await expect(
    saveJournalEntry(prisma, carlos, TX.sunpass03, { ...input, lines: [{ accountName: "Banco inventado", debitCents: 1000, creditCents: 0 }, { accountName: "Servicios", debitCents: 0, creditCents: 1000 }] }),
  ).rejects.toMatchObject({ code: "ACCOUNT_UNKNOWN" });

  const summary = await getFirm(prisma, carlos);
  const revisar = await firmQueue(prisma, carlos, "revisar");
  expect(revisar).toHaveLength(summary.awaitingReview);
  expect(revisar.some((row) => row.companyId === COMPANY.rivera)).toBe(true);

  await reopenTransaction(prisma, ana, TX.fs20394, "Reabro el sello para registrar el asiento.");
  await saveJournalEntry(prisma, carlos, TX.fs20394, input);
  const entry = await prisma.journalEntry.findUnique({ where: { transactionId: TX.fs20394 }, include: { lines: true } });
  expect(entry?.lines).toHaveLength(2);
  const debit = entry?.lines.reduce((sum, line) => sum + line.debitCents, 0);
  const credit = entry?.lines.reduce((sum, line) => sum + line.creditCents, 0);
  expect(debit).toBe(credit);
  const audit = await prisma.auditEvent.findFirst({ where: { transactionId: TX.fs20394, action: "asiento_saved" } });
  expect(audit?.actorId).toBe(USER.carlos);
  expect(audit?.previousJson).toContain("Combustible");
  expect(audit?.nextJson).toContain("Servicios");
  expect(audit?.nextJson).toContain("20394");
  await expect(firmQueue(prisma, padrino, "revisar")).rejects.toMatchObject({ code: "FIRM_FORBIDDEN" });
});

it("el propietario propone la categoría y el sello bloquea el cambio", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  const carlos = await loadActor(prisma, USER.carlos);
  if (!padrino || !carlos) throw new Error("faltan perfiles");
  const before = await prisma.transactionClassification.findUnique({ where: { transactionId: TX.sunpass27 } });
  await changeClassification(prisma, padrino, TX.sunpass27, { subcategoryId: CAT.qpl.mantenimiento });
  const saved = await prisma.transactionClassification.findUnique({ where: { transactionId: TX.sunpass27 } });
  expect(saved?.categoryId).toBe(CAT.qpl.operacion);
  expect(saved?.subcategoryId).toBe(CAT.qpl.mantenimiento);
  expect(saved?.source).toBe("owner");
  expect(saved?.state).toBe("Proposed");
  const audit = await prisma.auditEvent.findFirst({
    where: { transactionId: TX.sunpass27, action: "classification_changed", actorId: USER.padrino },
  });
  expect(audit?.previousJson).toContain(before?.subcategoryId ?? "missing");
  expect(audit?.nextJson).toContain(CAT.qpl.mantenimiento);
  await expect(changeClassification(prisma, padrino, TX.fs15012, { subcategoryId: CAT.qpl.peajes })).rejects.toMatchObject({ code: "SEALED" });
  await expect(
    changeClassification(prisma, carlos, TX.fs15012, { subcategoryId: CAT.qpl.peajes, justification: "No debe pasar el sello." }),
  ).rejects.toMatchObject({ code: "SEALED" });
  await expect(sealTransaction(prisma, padrino, TX.sunpass27)).rejects.toMatchObject({ code: "SEAL_FORBIDDEN" });
});

it("no concilia un movimiento sellado y concilia varios sin la marca de Serbell", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  if (!padrino) throw new Error("falta Padrino");
  const sealedBefore = await prisma.auditEvent.count({ where: { transactionId: TX.fs15012, action: "manual_reconcile" } });
  await expect(reconcileTransaction(prisma, padrino, TX.fs15012)).rejects.toMatchObject({ code: "SEALED" });
  expect(await prisma.auditEvent.count({ where: { transactionId: TX.fs15012, action: "manual_reconcile" } })).toBe(sealedBefore);
  const incomeBefore = await prisma.bankTransaction.findUnique({ where: { id: TX.income200 } });
  await expect(reconcileTransactions(prisma, padrino, [TX.income200, TX.fs15012])).rejects.toMatchObject({ code: "SEALED" });
  const incomeAfter = await prisma.bankTransaction.findUnique({ where: { id: TX.income200 } });
  expect(incomeAfter?.reconciliationState).toBe(incomeBefore?.reconciliationState);

  await reconcileTransactions(prisma, padrino, [TX.sunpass03, TX.income200]);
  for (const id of [TX.sunpass03, TX.income200]) {
    const row = await prisma.bankTransaction.findUnique({ where: { id } });
    expect(row?.reconciliationState).toBe("Reconciled");
    expect(row?.sealedAt).toBeNull();
    const manual = await prisma.auditEvent.findFirst({ where: { transactionId: id, action: "manual_reconcile", actorId: USER.padrino } });
    expect(manual?.nextJson).toContain("Reconciled");
    expect(await prisma.auditEvent.findFirst({ where: { transactionId: id, action: "serbell_matched" } })).toBeNull();
  }
  const audits = await prisma.auditEvent.count({ where: { transactionId: TX.sunpass03, action: "manual_reconcile" } });
  await reconcileTransactions(prisma, padrino, [TX.sunpass03]);
  expect(await prisma.auditEvent.count({ where: { transactionId: TX.sunpass03, action: "manual_reconcile" } })).toBe(audits);
});

it("reemplaza el comprobante y deja el anterior y el nuevo en la auditoría", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  if (!padrino) throw new Error("falta Padrino");
  const sealedLink = await prisma.transactionDocumentLink.findFirst({
    where: { transactionId: TX.fs15012, status: "confirmed" },
  });
  await expect(replaceTransactionDocument(prisma, padrino, TX.fs15012, "doc_qpl_sunpass")).rejects.toMatchObject({ code: "SEALED" });
  const sealedStill = await prisma.transactionDocumentLink.findFirst({
    where: { transactionId: TX.fs15012, status: "confirmed" },
  });
  expect(sealedStill?.documentId).toBe(sealedLink?.documentId);
  await expect(replaceTransactionDocument(prisma, padrino, TX.fs21148, "doc_qpl_fs_15012")).rejects.toMatchObject({ code: "ALREADY_LINKED" });

  const uploaded = await saveUploadedDocument(prisma, padrino, {
    companyId: COMPANY.qpl,
    fileName: "ticket-reemplazo.jpg",
    mimeType: "image/jpeg",
    bytes: Buffer.from("reemplazo-unico-comprobante-21148"),
  });
  await replaceTransactionDocument(prisma, padrino, TX.fs21148, uploaded.id);
  const link = await prisma.transactionDocumentLink.findFirst({ where: { transactionId: TX.fs21148, status: "confirmed" } });
  expect(link?.documentId).toBe(uploaded.id);
  const movement = await prisma.bankTransaction.findUnique({ where: { id: TX.fs21148 } });
  expect(movement?.documentState).toBe("Linked");
  const audit = await prisma.auditEvent.findFirst({ where: { transactionId: TX.fs21148, action: "document_replaced", actorId: USER.padrino } });
  expect(audit?.previousJson).toContain("doc_qpl_fs_21148");
  expect(audit?.previousJson).toContain("FleetSmarts_21148.jpg");
  expect(audit?.nextJson).toContain(uploaded.id);
  expect(audit?.nextJson).toContain("ticket-reemplazo.jpg");
  expect(await prisma.auditEvent.findFirst({ where: { transactionId: TX.fs21148, action: "serbell_matched" } })).toBeNull();
  const count = await prisma.auditEvent.count({ where: { transactionId: TX.fs21148, action: "document_replaced" } });
  await replaceTransactionDocument(prisma, padrino, TX.fs21148, uploaded.id);
  expect(await prisma.auditEvent.count({ where: { transactionId: TX.fs21148, action: "document_replaced" } })).toBe(count);
});

it("arma el tablero con los estados guardados y no mezcla empresas", async () => {
  const padrino = await loadActor(prisma, USER.padrino);
  const carlos = await loadActor(prisma, USER.carlos);
  const luis = await loadActor(prisma, USER.luis);
  if (!padrino || !carlos || !luis) throw new Error("faltan perfiles");
  const board = await documentBoard(prisma, padrino, COMPANY.qpl);
  const columnOf = (id: string) => (Object.keys(board) as (keyof typeof board)[]).find((key) => board[key].some((card) => card.id === id));
  expect(columnOf("doc_qpl_harbor")).toBe("recibido");
  expect(columnOf("doc_qpl_sunpass")).toBe("procesado");
  expect(columnOf("doc_qpl_dup_21148")).toBe("procesado");
  expect(board.procesado.find((card) => card.id === "doc_qpl_dup_21148")?.duplicate).toBe(true);
  expect(columnOf("doc_qpl_fs_15012")).toBe("sellado");
  expect(columnOf("doc_riv_ace")).toBeUndefined();
  await expect(documentBoard(prisma, luis, COMPANY.qpl)).rejects.toMatchObject({ code: "COMPANY_FORBIDDEN" });

  const review = await reviewBoard(prisma, carlos);
  const reviewOf = (id: string) => (Object.keys(review) as (keyof typeof review)[]).find((key) => review[key].some((card) => card.id === id));
  expect(reviewOf(TX.brian)).toBe("cliente");
  expect(reviewOf(TX.fs15012)).toBe("sellado");
  expect(reviewOf(TX.ace)).toBe("revisar");
  expect(review.revisar.find((card) => card.id === TX.ace)?.conflict).toBe(true);
  expect(reviewOf(TX.shell)).toBe("aprobar");
  expect(review.aprobar.find((card) => card.id === TX.shell)?.canSeal).toBe(true);
  expect(review.sellado.find((card) => card.id === TX.fs15012)?.canSeal).toBe(false);
  await expect(reviewBoard(prisma, padrino)).rejects.toMatchObject({ code: "FIRM_FORBIDDEN" });
});

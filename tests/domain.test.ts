import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CAT, COMPANY, TX, USER } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import {
  changeClassification,
  confirmExtraction,
  confirmLink,
  postChat,
  saveUploadedDocument,
  sealTransaction,
} from "@/server/domain";
import { getHome, getMovement, loadActor } from "@/server/queries";
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
  expect(home.balanceCents).toBe(414049);
  await prisma.bankAccount.update({ where: { id: home.accounts[0].id }, data: { availableBalanceCents: 100 } });
  const changed = await getHome(prisma, padrino, COMPANY.qpl);
  expect(changed.balanceCents).toBe(100);
  await prisma.bankAccount.update({ where: { id: home.accounts[0].id }, data: { availableBalanceCents: 414049 } });
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

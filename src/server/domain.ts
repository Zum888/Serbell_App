import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dayKey, isDay } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { NOTE_REPLY, UNSUPPORTED_REPLY, parseIntent } from "@/lib/intent";
import type { MatchResult } from "@/lib/matching";
import { normalizeMerchant } from "@/lib/matching";
import {
  assertCanMutate,
  assertCanReopen,
  assertCanSeal,
  assertCompanyAccess,
  canReview,
  type Actor,
} from "@/lib/permissions";
import { safeFileName } from "@/lib/utils";
import { localProviders } from "@/providers/local";
import type { Db } from "@/server/db";
import { nid, sha256 } from "@/server/ids";

const MAX_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

async function conversationFor(db: Db, companyId: string) {
  const existing = await db.conversation.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return db.conversation.create({
    data: { id: nid("conv"), companyId, title: "Serbell" },
  });
}

async function audit(
  db: Db,
  input: {
    companyId: string;
    actorId?: string | null;
    transactionId?: string | null;
    documentId?: string | null;
    action: string;
    previous?: unknown;
    next?: unknown;
    justification?: string | null;
  },
) {
  await db.auditEvent.create({
    data: {
      id: nid("aud"),
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      transactionId: input.transactionId ?? null,
      documentId: input.documentId ?? null,
      action: input.action,
      previousJson: input.previous === undefined ? null : JSON.stringify(input.previous),
      nextJson: input.next === undefined ? null : JSON.stringify(input.next),
      justification: input.justification ?? null,
    },
  });
}

async function requireDocument(db: Db, actor: Actor, documentId: string) {
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { extraction: true, links: true },
  });
  if (!document) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
  assertCompanyAccess(actor, document.companyId);
  return document;
}

async function requireTransaction(db: Db, transactionId: string) {
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: {
      classification: { include: { category: true, subcategory: true } },
      links: { where: { status: "confirmed" } },
      account: true,
    },
  });
  if (!transaction) throw new AppError("No existe ese movimiento.", 404, "NOT_FOUND");
  return transaction;
}

async function evaluateDocument(db: Db, documentId: string): Promise<MatchResult | null> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { extraction: true },
  });
  if (!document?.extraction?.merchant || document.extraction.amountCents === null) return null;
  const transactions = await db.bankTransaction.findMany({
    where: { companyId: document.companyId },
    include: { links: { where: { status: "confirmed" } } },
  });
  const documents = await db.document.findMany({
    where: { companyId: document.companyId, id: { not: document.id } },
    include: { extraction: true },
  });
  return localProviders(db).matching.evaluate({
    document: {
      id: document.id,
      merchant: document.extraction.merchant,
      amountCents: document.extraction.amountCents,
      currency: document.extraction.currency ?? "USD",
      occurredOn: dayKey(document.extraction.occurredOn),
      fileHash: document.fileHash,
    },
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      merchant: transaction.merchant,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      postedOn: dayKey(transaction.postedOn) ?? "",
      confirmedDocumentId: transaction.links[0]?.documentId ?? null,
    })),
    documents: documents.map((other) => ({
      id: other.id,
      merchant: other.extraction?.merchant ?? null,
      amountCents: other.extraction?.amountCents ?? null,
      occurredOn: dayKey(other.extraction?.occurredOn),
      fileHash: other.fileHash,
    })),
  });
}

async function matchDocument(db: Db, documentId: string): Promise<MatchResult> {
  const result = await evaluateDocument(db, documentId);
  if (!result) {
    throw new AppError("Completa comercio e importe antes de buscar coincidencias.", 400, "EXTRACTION_INCOMPLETE");
  }

  await db.matchCandidate.deleteMany({ where: { documentId } });
  for (const candidate of result.candidates) {
    await db.matchCandidate.create({
      data: {
        id: nid("cand"),
        documentId,
        transactionId: candidate.transactionId,
        decision: result.decision,
        evidenceJson: JSON.stringify(candidate.evidence),
        reasonsForJson: JSON.stringify(candidate.reasonsFor),
        reasonsAgainstJson: JSON.stringify(candidate.reasonsAgainst),
        blocked: candidate.blocked,
      },
    });
  }

  if (result.decision === "reliable" || result.decision === "ambiguous") {
    const ids = result.candidates.filter((candidate) => !candidate.blocked).map((candidate) => candidate.transactionId);
    if (ids.length) {
      await db.bankTransaction.updateMany({
        where: { id: { in: ids }, documentState: "Missing", sealedAt: null },
        data: { documentState: "Suggested" },
      });
    }
  }
  if (result.decision === "duplicate" && result.duplicateOfDocumentId) {
    await db.document.update({
      where: { id: documentId },
      data: { status: "duplicate", duplicateOfId: result.duplicateOfDocumentId },
    });
  }
  if (result.decision === "conflict") {
    await db.document.update({ where: { id: documentId }, data: { status: "conflict" } });
  }
  if (result.decision === "none") {
    const existing = await db.task.findFirst({
      where: { documentId, kind: "no_match", status: "open" },
    });
    if (!existing) {
      const owner = await db.document.findUnique({ where: { id: documentId }, select: { companyId: true } });
      if (!owner) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
      await db.task.create({
        data: {
          id: nid("task"),
          companyId: owner.companyId,
          documentId,
          kind: "no_match",
          title: "Comprobante sin movimiento bancario",
          status: "open",
        },
      });
    }
    await db.document.update({ where: { id: documentId }, data: { status: "pending" } });
  }
  return result;
}

function describeMatch(result: MatchResult): string {
  if (result.decision === "reliable") {
    return `Encontré una coincidencia compatible. ${result.reasonsFor.join(" ")}`.trim();
  }
  if (result.decision === "ambiguous") {
    return result.reasonsAgainst.join(" ");
  }
  if (result.decision === "conflict") {
    return result.reasonsAgainst.join(" ");
  }
  if (result.decision === "duplicate") {
    return result.reasonsAgainst.join(" ");
  }
  return result.reasonsAgainst.join(" ") || "No hay un movimiento compatible.";
}

export async function saveUploadedDocument(
  db: Db,
  actor: Actor,
  input: { companyId: string; fileName: string; mimeType: string; bytes: Buffer },
) {
  assertCompanyAccess(actor, input.companyId);
  if (!input.bytes.byteLength) throw new AppError("El archivo está vacío.", 400, "EMPTY_FILE");
  if (input.bytes.byteLength > MAX_BYTES) throw new AppError("El archivo supera 8 MB.", 400, "FILE_TOO_LARGE");
  if (!ALLOWED_TYPES.has(input.mimeType)) {
    throw new AppError("Solo se aceptan JPG, PNG, WEBP o PDF.", 400, "FILE_TYPE");
  }
  const providers = localProviders(db);
  const draft = providers.extraction.extract(input.fileName);
  const hash = sha256(input.bytes);
  const duplicate = await db.document.findFirst({
    where: { companyId: input.companyId, fileHash: hash },
  });
  const id = nid("doc");
  const fileName = safeFileName(input.fileName);
  const storagePath = path.join("storage", "uploads", input.companyId, `${id}-${fileName}`);
  const absolute = path.join(process.cwd(), storagePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, input.bytes);

  let categoryId: string | null = null;
  let subcategoryId: string | null = null;
  if (draft.categoryName && draft.subcategoryName) {
    const categories = await providers.accounting.listCategories(input.companyId);
    const parent = categories.find(
      (category) => !category.parentId && normalizeMerchant(category.name) === normalizeMerchant(draft.categoryName ?? ""),
    );
    const child = categories.find(
      (category) =>
        parent &&
        category.parentId === parent.id &&
        normalizeMerchant(category.name) === normalizeMerchant(draft.subcategoryName ?? ""),
    );
    if (parent && child) {
      categoryId = parent.id;
      subcategoryId = child.id;
    }
  }

  await db.document.create({
    data: {
      id,
      companyId: input.companyId,
      uploadedById: actor.id,
      fileName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      storagePath,
      fileHash: hash,
      status: duplicate ? "duplicate" : "received",
      duplicateOfId: duplicate?.id ?? null,
    },
  });
  await db.documentExtraction.create({
    data: {
      id: nid("ext"),
      documentId: id,
      merchant: draft.merchant,
      amountCents: draft.amountCents,
      currency: draft.currency,
      occurredOn: draft.occurredOn ? new Date(`${draft.occurredOn}T12:00:00.000Z`) : null,
      categoryId,
      subcategoryId,
      source: draft.source,
      isDemonstration: draft.isDemonstration,
      notice: draft.notice,
    },
  });
  const conversation = await conversationFor(db, input.companyId);
  await db.conversation.update({ where: { id: conversation.id }, data: { activeDocumentId: id } });
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    documentId: id,
    role: "user",
    body: `Te mando el comprobante ${fileName}.`,
    intent: "attach",
  });
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId: id,
    role: "assistant",
    body: draft.notice,
    intent: "attach",
  });
  if (duplicate) {
    await audit(db, {
      companyId: input.companyId,
      actorId: actor.id,
      documentId: id,
      action: "duplicate_detected",
      next: { duplicateOfId: duplicate.id },
    });
  }
  return { id };
}

export async function updateExtraction(
  db: Db,
  actor: Actor,
  documentId: string,
  input: { merchant: string; amountCents: number; occurredOn: string | null },
) {
  const document = await requireDocument(db, actor, documentId);
  const merchant = input.merchant.trim();
  if (!merchant) throw new AppError("El comercio es obligatorio.", 400, "MERCHANT_REQUIRED");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new AppError("El importe tiene que ser un valor positivo en centavos.", 400, "AMOUNT_INVALID");
  }
  if (input.occurredOn && !isDay(input.occurredOn)) {
    throw new AppError("La fecha no es válida.", 400, "DATE_INVALID");
  }
  await db.documentExtraction.update({
    where: { documentId },
    data: {
      merchant,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn ? new Date(`${input.occurredOn}T12:00:00.000Z`) : null,
      source: "user",
      isDemonstration: false,
      notice: "Datos capturados por el usuario. No provienen de una lectura automática.",
      verifiedAt: null,
      verifiedById: null,
      categoryId: null,
      subcategoryId: null,
    },
  });
  await db.document.update({ where: { id: document.id }, data: { status: "received" } });
}

export async function confirmExtraction(db: Db, actor: Actor, documentId: string) {
  const document = await requireDocument(db, actor, documentId);
  if (!document.extraction?.merchant || document.extraction.amountCents === null) {
    throw new AppError(
      "Completa comercio, fecha e importe antes de confirmar. No se inventan datos.",
      400,
      "EXTRACTION_INCOMPLETE",
    );
  }
  await db.documentExtraction.update({
    where: { documentId },
    data: { verifiedAt: new Date(), verifiedById: actor.id },
  });
  const result = await matchDocument(db, documentId);
  const conversation = await conversationFor(db, document.companyId);
  const providers = localProviders(db);
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    documentId,
    role: "user",
    body: "Confirmo comercio, fecha e importe.",
    intent: "confirm_extraction",
  });
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId,
    role: "assistant",
    body: describeMatch(result),
    intent: "search_matches",
  });
  await audit(db, {
    companyId: document.companyId,
    actorId: actor.id,
    documentId,
    action: result.decision === "none" ? "match_none" : result.decision === "conflict" ? "match_conflict" : "extraction_verified",
    next: { decision: result.decision, proposedTransactionId: result.proposedTransactionId },
  });
  return result;
}

export async function confirmLink(db: Db, actor: Actor, documentId: string, transactionId: string) {
  const document = await requireDocument(db, actor, documentId);
  if (!document.extraction?.verifiedAt) {
    throw new AppError("Confirma los datos del comprobante antes de vincular.", 400, "NOT_VERIFIED");
  }
  const result = await matchDocument(db, documentId);
  if (result.decision === "duplicate" || result.decision === "conflict" || result.decision === "none") {
    throw new AppError(describeMatch(result), 409, result.decision.toUpperCase());
  }
  const candidate = result.candidates.find((item) => item.transactionId === transactionId && !item.blocked);
  if (!candidate) {
    throw new AppError("Ese movimiento no es un candidato compatible.", 400, "NOT_A_CANDIDATE");
  }
  if (result.decision === "reliable" && result.proposedTransactionId !== transactionId) {
    throw new AppError("La coincidencia única es otro movimiento.", 400, "NOT_THE_MATCH");
  }
  const transaction = await requireTransaction(db, transactionId);
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  if (transaction.companyId !== document.companyId) {
    throw new AppError("El comprobante y el movimiento son de empresas distintas.", 403, "COMPANY_FORBIDDEN");
  }
  if (transaction.links.length) {
    throw new AppError(
      "El movimiento compatible ya tiene un comprobante vinculado. No se asigna otro automáticamente.",
      409,
      "CONFLICT",
    );
  }
  const existingForDocument = document.links.find((link) => link.status === "confirmed");
  if (existingForDocument) {
    throw new AppError("Este comprobante ya está vinculado.", 409, "ALREADY_LINKED");
  }
  await db.transactionDocumentLink.create({
    data: {
      id: nid("link"),
      transactionId,
      documentId,
      status: "confirmed",
      confirmedById: actor.id,
      confirmedAt: new Date(),
    },
  });
  const extraction = document.extraction;
  let categoryId = transaction.classification?.categoryId ?? null;
  let subcategoryId = transaction.classification?.subcategoryId ?? null;
  if (!subcategoryId && extraction.subcategoryId && extraction.categoryId) {
    categoryId = extraction.categoryId;
    subcategoryId = extraction.subcategoryId;
    if (transaction.classification) {
      await db.transactionClassification.update({
        where: { transactionId },
        data: { categoryId, subcategoryId, source: "extraction", state: "Proposed" },
      });
    } else {
      await db.transactionClassification.create({
        data: {
          id: nid("class"),
          transactionId,
          categoryId,
          subcategoryId,
          source: "extraction",
          state: "Proposed",
        },
      });
    }
  }
  const previous = {
    documentState: transaction.documentState,
    accountingState: transaction.accountingState,
    reviewState: transaction.reviewState,
  };
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: {
      documentState: "Linked",
      accountingState:
        transaction.accountingState === "Uncategorized" && subcategoryId ? "Proposed" : transaction.accountingState,
    },
  });
  await db.document.update({ where: { id: documentId }, data: { status: "linked" } });
  const otherIds = result.candidates.map((item) => item.transactionId).filter((id) => id !== transactionId);
  if (otherIds.length) {
    await db.bankTransaction.updateMany({
      where: { id: { in: otherIds }, documentState: "Suggested", sealedAt: null },
      data: { documentState: "Missing" },
    });
  }
  await db.matchCandidate.deleteMany({ where: { documentId, transactionId: { not: transactionId } } });
  await db.message.updateMany({
    where: { documentId, transactionId: null },
    data: { transactionId },
  });
  const conversation = await conversationFor(db, document.companyId);
  const providers = localProviders(db);
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    documentId,
    transactionId,
    role: "user",
    body: "Confirmo el vínculo con el movimiento bancario.",
    intent: "confirm_link",
  });
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId,
    transactionId,
    role: "assistant",
    body: `Vínculo confirmado con ${transaction.merchant} del ${dayKey(transaction.postedOn)}. El comprobante queda ligado. La revisión del contador sigue pendiente.`,
    intent: "confirm_link",
  });
  const classifiedByService = Boolean(!transaction.classification?.subcategoryId && extraction.subcategoryId && extraction.categoryId);
  await audit(db, {
    companyId: document.companyId,
    actorId: actor.id,
    transactionId,
    documentId,
    action: "link_confirmed",
    previous,
    next: {
      documentState: "Linked",
      categoryId,
      subcategoryId,
      reviewState: transaction.reviewState,
      accountingState: subcategoryId ? "Proposed" : transaction.accountingState,
    },
  });
  if (result.decision === "reliable" || classifiedByService) {
    await audit(db, {
      companyId: document.companyId,
      transactionId,
      documentId,
      action: "serbell_matched",
      next: {
        decision: result.decision,
        linked: true,
        classified: classifiedByService,
        categoryId,
        subcategoryId,
      },
    });
  }
}

export async function reconcileTransactions(db: Db, actor: Actor, ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) throw new AppError("Selecciona un movimiento.", 400, "NONE");
  const transactions = [];
  for (const id of unique) {
    const transaction = await requireTransaction(db, id);
    assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
    transactions.push(transaction);
  }
  const reconciled: string[] = [];
  for (const transaction of transactions) {
    if (transaction.reconciliationState === "Reconciled") continue;
    await db.bankTransaction.update({
      where: { id: transaction.id },
      data: { reconciliationState: "Reconciled" },
    });
    await audit(db, {
      companyId: transaction.companyId,
      actorId: actor.id,
      transactionId: transaction.id,
      action: "manual_reconcile",
      previous: { reconciliationState: transaction.reconciliationState },
      next: { reconciliationState: "Reconciled" },
    });
    reconciled.push(transaction.id);
  }
  return reconciled;
}

export async function reconcileTransaction(db: Db, actor: Actor, transactionId: string) {
  await reconcileTransactions(db, actor, [transactionId]);
}

export async function replaceTransactionDocument(db: Db, actor: Actor, transactionId: string, documentId: string) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  const document = await requireDocument(db, actor, documentId);
  if (document.companyId !== transaction.companyId) {
    throw new AppError("El comprobante y el movimiento son de empresas distintas.", 403, "COMPANY_FORBIDDEN");
  }
  const previousLink = await db.transactionDocumentLink.findFirst({
    where: { transactionId, status: "confirmed" },
    include: { document: true },
  });
  if (previousLink?.documentId === documentId) return documentId;
  const taken = await db.transactionDocumentLink.findFirst({
    where: { documentId, status: "confirmed", NOT: { transactionId } },
  });
  if (taken) {
    throw new AppError("Ese comprobante ya está vinculado a otro movimiento.", 409, "ALREADY_LINKED");
  }
  if (previousLink) {
    await db.transactionDocumentLink.delete({ where: { id: previousLink.id } });
    const remaining = await db.transactionDocumentLink.count({
      where: { documentId: previousLink.documentId, status: "confirmed" },
    });
    if (!remaining && previousLink.document.status === "linked") {
      await db.document.update({
        where: { id: previousLink.documentId },
        data: { status: "received" },
      });
    }
  }
  await db.transactionDocumentLink.create({
    data: {
      id: nid("link"),
      transactionId,
      documentId,
      status: "confirmed",
      confirmedById: actor.id,
      confirmedAt: new Date(),
    },
  });
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: { documentState: "Linked" },
  });
  await db.document.update({ where: { id: documentId }, data: { status: "linked" } });
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    documentId,
    action: "document_replaced",
    previous: previousLink
      ? { documentId: previousLink.documentId, fileName: previousLink.document.fileName }
      : { documentId: null, fileName: null },
    next: { documentId, fileName: document.fileName },
  });
  return documentId;
}

export async function uploadReplacementDocument(
  db: Db,
  actor: Actor,
  transactionId: string,
  file: { fileName: string; mimeType: string; bytes: Buffer },
) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  const saved = await saveUploadedDocument(db, actor, {
    companyId: transaction.companyId,
    fileName: file.fileName,
    mimeType: file.mimeType,
    bytes: file.bytes,
  });
  return replaceTransactionDocument(db, actor, transactionId, saved.id);
}

export async function stampReliableMatcherLinks(db: Db) {
  const links = await db.transactionDocumentLink.findMany({
    where: { status: "confirmed" },
    select: { transactionId: true, documentId: true },
  });
  for (const link of links) {
    const already = await db.auditEvent.findFirst({
      where: { transactionId: link.transactionId, action: "serbell_matched" },
    });
    if (already) continue;
    const result = await evaluateDocument(db, link.documentId);
    if (!result || result.decision !== "reliable" || result.proposedTransactionId !== link.transactionId) continue;
    const transaction = await db.bankTransaction.findUnique({ where: { id: link.transactionId } });
    if (!transaction) continue;
    await audit(db, {
      companyId: transaction.companyId,
      transactionId: link.transactionId,
      documentId: link.documentId,
      action: "serbell_matched",
      next: { decision: "reliable", linked: true },
    });
  }
}

export async function postponeLink(db: Db, actor: Actor, documentId: string) {
  const document = await requireDocument(db, actor, documentId);
  const conversation = await conversationFor(db, document.companyId);
  const providers = localProviders(db);
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    documentId,
    role: "user",
    body: "Reviso el vínculo después.",
    intent: "reject_link",
  });
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId,
    role: "assistant",
    body: "Dejé el comprobante sin vincular. Las coincidencias siguen guardadas.",
    intent: "reject_link",
  });
  await audit(db, {
    companyId: document.companyId,
    actorId: actor.id,
    documentId,
    action: "link_postponed",
  });
}

export async function rejectLink(db: Db, actor: Actor, documentId: string) {
  const document = await requireDocument(db, actor, documentId);
  const candidates = await db.matchCandidate.findMany({ where: { documentId } });
  await db.matchCandidate.deleteMany({ where: { documentId } });
  for (const candidate of candidates) {
    const linked = await db.transactionDocumentLink.count({
      where: { transactionId: candidate.transactionId, status: "confirmed" },
    });
    if (!linked) {
      const remaining = await db.matchCandidate.count({
        where: { transactionId: candidate.transactionId, blocked: false },
      });
      await db.bankTransaction.updateMany({
        where: { id: candidate.transactionId, sealedAt: null, documentState: { in: ["Suggested", "Missing"] } },
        data: { documentState: remaining ? "Suggested" : "Missing" },
      });
    }
  }
  const conversation = await conversationFor(db, document.companyId);
  await localProviders(db).messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId,
    role: "assistant",
    body: "Rechacé las coincidencias propuestas. El comprobante sigue sin vínculo.",
    intent: "reject_link",
  });
  await audit(db, {
    companyId: document.companyId,
    actorId: actor.id,
    documentId,
    action: "link_rejected",
  });
}

export async function changeClassification(
  db: Db,
  actor: Actor,
  transactionId: string,
  input: { subcategoryId: string; justification?: string },
) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  const subcategory = await db.accountingCategory.findUnique({
    where: { id: input.subcategoryId },
    include: { parent: true },
  });
  if (!subcategory || !subcategory.parentId || subcategory.companyId !== transaction.companyId || !subcategory.parent) {
    throw new AppError("La subcategoría no pertenece a esta empresa o no depende de una categoría.", 400, "CATEGORY_INVALID");
  }
  const before = {
    categoryId: transaction.classification?.categoryId ?? null,
    subcategoryId: transaction.classification?.subcategoryId ?? null,
    categoryName: transaction.classification?.category?.name ?? null,
    subcategoryName: transaction.classification?.subcategory?.name ?? null,
  };
  const after = {
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    categoryName: subcategory.parent.name,
    subcategoryName: subcategory.name,
  };
  if (before.subcategoryId === after.subcategoryId) return;
  const reviewer = canReview(actor, transaction.companyId);
  const justification = input.justification?.trim() || null;
  if (reviewer && (!justification || justification.length < 8)) {
    throw new AppError("La corrección del contador necesita una justificación.", 400, "JUSTIFICATION_REQUIRED");
  }
  const classificationState = reviewer ? "Recorded" : "Proposed";
  if (transaction.classification) {
    await db.transactionClassification.update({
      where: { transactionId },
      data: {
        categoryId: after.categoryId,
        subcategoryId: after.subcategoryId,
        source: reviewer ? "accountant" : "owner",
        state: classificationState,
      },
    });
  } else {
    await db.transactionClassification.create({
      data: {
        id: nid("class"),
        transactionId,
        categoryId: after.categoryId,
        subcategoryId: after.subcategoryId,
        source: reviewer ? "accountant" : "owner",
        state: classificationState,
      },
    });
  }
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: {
      accountingState: classificationState,
      reviewState: transaction.reviewState === "Approved" ? "NeedsReview" : transaction.reviewState,
    },
  });
  if (reviewer) {
    await localProviders(db).rules.record({
      companyId: transaction.companyId,
      actorId: actor.id,
      transactionId,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
      justification,
    });
    await db.accountingReview.create({
      data: {
        id: nid("rev"),
        transactionId,
        actorId: actor.id,
        action: "correct",
        previousJson: JSON.stringify(before),
        nextJson: JSON.stringify(after),
        justification,
      },
    });
  }
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    action: "classification_changed",
    previous: before,
    next: after,
    justification,
  });
}

export async function saveJournalEntry(
  db: Db,
  actor: Actor,
  transactionId: string,
  input: {
    subcategoryId: string;
    justification?: string;
    lines: { accountName: string; debitCents: number; creditCents: number }[];
  },
) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  if (!canReview(actor, transaction.companyId)) {
    throw new AppError("El servidor rechazó el asiento: solo el contador puede registrarlo.", 403, "ASIENTO_FORBIDDEN");
  }
  const justification = input.justification?.trim() ?? "";
  if (justification.length < 8) {
    throw new AppError("El asiento necesita una justificación.", 400, "JUSTIFICATION_REQUIRED");
  }
  const subcategory = await db.accountingCategory.findUnique({
    where: { id: input.subcategoryId },
    include: { parent: true },
  });
  if (!subcategory || !subcategory.parentId || subcategory.companyId !== transaction.companyId || !subcategory.parent) {
    throw new AppError("La subcategoría no pertenece a esta empresa o no depende de una categoría.", 400, "CATEGORY_INVALID");
  }
  const catalog = await db.accountingCategory.findMany({
    where: { companyId: transaction.companyId },
    select: { name: true },
  });
  const names = new Set(catalog.map((row) => row.name));
  const lines = input.lines
    .map((line) => ({
      accountName: line.accountName.trim(),
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    }))
    .filter((line) => line.accountName || line.debitCents || line.creditCents);
  if (!lines.some((line) => line.debitCents > 0) || !lines.some((line) => line.creditCents > 0)) {
    throw new AppError("El asiento necesita al menos un débito y un crédito.", 400, "ASIENTO_INCOMPLETE");
  }
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (!names.has(line.accountName)) {
      throw new AppError(`La cuenta «${line.accountName}» no está en el catálogo de esta empresa.`, 400, "ACCOUNT_UNKNOWN");
    }
    if (!Number.isInteger(line.debitCents) || !Number.isInteger(line.creditCents) || line.debitCents < 0 || line.creditCents < 0) {
      throw new AppError("Los importes del asiento tienen que ser centavos enteros.", 400, "AMOUNT_INVALID");
    }
    if (line.debitCents > 0 && line.creditCents > 0) {
      throw new AppError("Una línea no puede tener débito y crédito a la vez.", 400, "LINE_BOTH");
    }
    if (line.debitCents === 0 && line.creditCents === 0) {
      throw new AppError("Cada línea del asiento necesita un importe en centavos.", 400, "LINE_EMPTY");
    }
    debit += line.debitCents;
    credit += line.creditCents;
  }
  if (debit !== credit) {
    throw new AppError("El asiento no cuadra: los débitos y los créditos tienen que ser iguales.", 400, "ASIENTO_UNBALANCED");
  }
  const existing = await db.journalEntry.findUnique({
    where: { transactionId },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  const previous = {
    categoryId: transaction.classification?.categoryId ?? null,
    subcategoryId: transaction.classification?.subcategoryId ?? null,
    categoryName: transaction.classification?.category?.name ?? null,
    subcategoryName: transaction.classification?.subcategory?.name ?? null,
    lines: (existing?.lines ?? []).map((line) => ({
      accountName: line.accountName,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    })),
  };
  const next = {
    categoryId: subcategory.parentId,
    subcategoryId: subcategory.id,
    categoryName: subcategory.parent.name,
    subcategoryName: subcategory.name,
    lines: lines.map((line) => ({
      accountName: line.accountName,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    })),
  };
  const entryId = existing?.id ?? nid("je");
  await db.$transaction(async (tx) => {
    if (transaction.classification) {
      await tx.transactionClassification.update({
        where: { transactionId },
        data: {
          categoryId: next.categoryId,
          subcategoryId: next.subcategoryId,
          source: "accountant",
          state: "Recorded",
        },
      });
    } else {
      await tx.transactionClassification.create({
        data: {
          id: nid("class"),
          transactionId,
          categoryId: next.categoryId,
          subcategoryId: next.subcategoryId,
          source: "accountant",
          state: "Recorded",
        },
      });
    }
    await tx.bankTransaction.update({
      where: { id: transactionId },
      data: {
        accountingState: transaction.accountingState === "Approved" ? "Approved" : "Recorded",
        reviewState: transaction.reviewState === "Approved" ? "NeedsReview" : transaction.reviewState,
      },
    });
    if (existing) {
      await tx.journalLine.deleteMany({ where: { entryId: existing.id } });
    } else {
      await tx.journalEntry.create({
        data: { id: entryId, companyId: transaction.companyId, transactionId, memo: transaction.merchant },
      });
    }
    await tx.journalLine.createMany({
      data: lines.map((line) => ({
        id: nid("jl"),
        entryId,
        accountName: line.accountName,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
      })),
    });
    await tx.accountingReview.create({
      data: {
        id: nid("rev"),
        transactionId,
        actorId: actor.id,
        action: "asiento",
        previousJson: JSON.stringify(previous),
        nextJson: JSON.stringify(next),
        justification,
      },
    });
    await tx.auditEvent.create({
      data: {
        id: nid("aud"),
        companyId: transaction.companyId,
        actorId: actor.id,
        transactionId,
        action: "asiento_saved",
        previousJson: JSON.stringify(previous),
        nextJson: JSON.stringify(next),
        justification,
      },
    });
  });
}

export async function sealTransaction(db: Db, actor: Actor, transactionId: string) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanSeal(actor, transaction.companyId);
  if (transaction.sealedAt) throw new AppError("El movimiento ya está sellado.", 400, "ALREADY_SEALED");
  if (!transaction.classification?.categoryId || !transaction.classification.subcategoryId) {
    throw new AppError("Asigna categoría y subcategoría antes de sellar.", 400, "CATEGORY_REQUIRED");
  }
  const documentId = transaction.links[0]?.documentId ?? null;
  const previous = {
    reviewState: transaction.reviewState,
    accountingState: transaction.accountingState,
    sealedAt: null,
    documentId,
    categoryId: transaction.classification.categoryId,
    subcategoryId: transaction.classification.subcategoryId,
  };
  const sealedAt = new Date();
  const next = {
    reviewState: "Approved",
    accountingState: "Approved",
    sealedAt: sealedAt.toISOString(),
    documentId,
    categoryId: transaction.classification.categoryId,
    subcategoryId: transaction.classification.subcategoryId,
  };
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reviewState: "Approved",
      accountingState: "Approved",
      sealedAt,
      sealedById: actor.id,
    },
  });
  await db.transactionClassification.update({
    where: { transactionId },
    data: { state: "Approved" },
  });
  await db.accountingReview.create({
    data: {
      id: nid("rev"),
      transactionId,
      actorId: actor.id,
      action: "seal",
      previousJson: JSON.stringify(previous),
      nextJson: JSON.stringify(next),
    },
  });
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    documentId,
    action: "seal",
    previous,
    next,
  });
}

export async function reopenTransaction(db: Db, actor: Actor, transactionId: string, justification: string) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanReopen(actor, transaction.companyId);
  const reason = justification.trim();
  if (reason.length < 8) {
    throw new AppError("La reapertura exige una justificación.", 400, "JUSTIFICATION_REQUIRED");
  }
  if (!transaction.sealedAt) throw new AppError("El movimiento no está sellado.", 400, "NOT_SEALED");
  const previous = {
    reviewState: transaction.reviewState,
    accountingState: transaction.accountingState,
    sealedAt: transaction.sealedAt.toISOString(),
  };
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: { reviewState: "Reopened", accountingState: "Recorded", sealedAt: null, sealedById: null },
  });
  await db.accountingReview.create({
    data: {
      id: nid("rev"),
      transactionId,
      actorId: actor.id,
      action: "reopen",
      previousJson: JSON.stringify(previous),
      nextJson: JSON.stringify({ reviewState: "Reopened", sealedAt: null }),
      justification: reason,
    },
  });
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    documentId: transaction.links[0]?.documentId ?? null,
    action: "reopen",
    previous,
    next: { reviewState: "Reopened", sealedAt: null },
    justification: reason,
  });
}

export async function requestClarification(db: Db, actor: Actor, transactionId: string, message: string) {
  const transaction = await requireTransaction(db, transactionId);
  assertCanSeal(actor, transaction.companyId);
  if (transaction.sealedAt) {
    throw new AppError("El servidor rechazó la edición: el movimiento está sellado.", 403, "SEALED");
  }
  const body = message.trim();
  if (body.length < 8) throw new AppError("Escribe la aclaración que necesitas.", 400, "MESSAGE_REQUIRED");
  await db.task.create({
    data: {
      id: nid("task"),
      companyId: transaction.companyId,
      transactionId,
      kind: "clarification",
      title: body,
      status: "open",
    },
  });
  await db.bankTransaction.update({
    where: { id: transactionId },
    data: { reviewState: "NeedsClient" },
  });
  const conversation = await conversationFor(db, transaction.companyId);
  await localProviders(db).messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    transactionId,
    role: "user",
    body,
    intent: "clarification",
  });
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    action: "clarification_requested",
    next: { reviewState: "NeedsClient" },
    justification: body,
  });
}

async function activeLinkedTransaction(db: Db, companyId: string) {
  const conversation = await conversationFor(db, companyId);
  if (!conversation.activeDocumentId) return null;
  const link = await db.transactionDocumentLink.findFirst({
    where: { documentId: conversation.activeDocumentId, status: "confirmed" },
  });
  return link?.transactionId ?? null;
}

export async function postChat(db: Db, actor: Actor, companyId: string, text: string) {
  assertCompanyAccess(actor, companyId);
  const body = text.trim();
  if (!body) throw new AppError("Escribe un mensaje.", 400, "EMPTY_MESSAGE");
  const intent = parseIntent(body);
  const conversation = await conversationFor(db, companyId);
  const providers = localProviders(db);
  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: actor.id,
    documentId: conversation.activeDocumentId,
    role: "user",
    body,
    intent: intent.type,
  });

  let reply = NOTE_REPLY;
  try {
    if (intent.type === "unsupported") {
      reply = UNSUPPORTED_REPLY;
    } else if (intent.type === "note") {
      reply = NOTE_REPLY;
    } else if (intent.type === "operation_status") {
      const [movements, missing, review, sealed, tasks] = await Promise.all([
        db.bankTransaction.count({ where: { companyId } }),
        db.bankTransaction.count({ where: { companyId, documentState: "Missing" } }),
        db.bankTransaction.count({ where: { companyId, reviewState: "NeedsReview" } }),
        db.bankTransaction.count({ where: { companyId, sealedAt: { not: null } } }),
        db.task.count({ where: { companyId, status: "open" } }),
      ]);
      const company = await db.company.findUnique({ where: { id: companyId } });
      reply = `Estado real de ${company?.name ?? "la empresa"}: ${movements} movimientos, ${missing} sin comprobante, ${review} por revisar, ${sealed} sellados, ${tasks} solicitudes abiertas.`;
    } else if (intent.type === "confirm_extraction") {
      if (!conversation.activeDocumentId) throw new AppError("No hay un comprobante activo para confirmar.", 400, "NO_DOCUMENT");
      await confirmExtraction(db, actor, conversation.activeDocumentId);
      reply = "Confirmé los datos guardados y busqué coincidencias en los movimientos de esta empresa.";
    } else if (intent.type === "search_matches") {
      if (!conversation.activeDocumentId) throw new AppError("No hay un comprobante activo.", 400, "NO_DOCUMENT");
      const document = await requireDocument(db, actor, conversation.activeDocumentId);
      if (!document.extraction?.verifiedAt) {
        throw new AppError("Confirma los datos del comprobante antes de buscar.", 400, "NOT_VERIFIED");
      }
      const result = await matchDocument(db, document.id);
      reply = describeMatch(result);
    } else if (intent.type === "confirm_link") {
      if (!conversation.activeDocumentId) throw new AppError("No hay un comprobante activo.", 400, "NO_DOCUMENT");
      const result = await matchDocument(db, conversation.activeDocumentId);
      if (result.decision !== "reliable" || !result.proposedTransactionId) {
        throw new AppError(
          result.decision === "ambiguous"
            ? "Hay varias coincidencias. Elige una en el panel; no elijo por ti."
            : describeMatch(result),
          409,
          "NOT_RELIABLE",
        );
      }
      await confirmLink(db, actor, conversation.activeDocumentId, result.proposedTransactionId);
      reply = "Confirmé el vínculo con la única coincidencia compatible.";
    } else if (intent.type === "reject_link") {
      if (!conversation.activeDocumentId) throw new AppError("No hay un comprobante activo.", 400, "NO_DOCUMENT");
      await rejectLink(db, actor, conversation.activeDocumentId);
      reply = "Rechacé el vínculo propuesto.";
    } else if (intent.type === "answer_request") {
      const task = await db.task.findFirst({
        where: { companyId, kind: "clarification", status: "open" },
        orderBy: { createdAt: "desc" },
      });
      if (!task) throw new AppError("No hay una solicitud de aclaración abierta.", 404, "NO_REQUEST");
      await db.task.update({ where: { id: task.id }, data: { status: "done" } });
      if (task.transactionId) {
        await db.bankTransaction.updateMany({
          where: { id: task.transactionId, reviewState: "NeedsClient", sealedAt: null },
          data: { reviewState: "NeedsReview" },
        });
      }
      await providers.messaging.append({
        conversationId: conversation.id,
        authorId: actor.id,
        transactionId: task.transactionId,
        role: "user",
        body: intent.body,
        intent: "answer_request",
      });
      reply = "Registré la respuesta y volví a dejar el movimiento por revisar.";
      await audit(db, {
        companyId,
        actorId: actor.id,
        transactionId: task.transactionId,
        action: "clarification_answered",
        next: { taskId: task.id, reviewState: "NeedsReview" },
        justification: intent.body,
      });
    } else if (intent.type === "change_category") {
      const transactionId = await activeLinkedTransaction(db, companyId);
      if (!transactionId) {
        throw new AppError("No hay un movimiento vinculado en esta conversación para cambiar la categoría.", 400, "NO_TRANSACTION");
      }
      const categories = await providers.accounting.listCategories(companyId);
      const parent = categories.find(
        (category) => !category.parentId && normalizeMerchant(category.name) === normalizeMerchant(intent.category),
      );
      const child = categories.find(
        (category) =>
          parent &&
          category.parentId === parent.id &&
          normalizeMerchant(category.name) === normalizeMerchant(intent.subcategory),
      );
      if (!parent || !child) {
        throw new AppError("No encontré esa categoría y subcategoría en esta empresa.", 400, "CATEGORY_INVALID");
      }
      await changeClassification(db, actor, transactionId, { subcategoryId: child.id, justification: body });
      reply = `Actualicé la clasificación a ${parent.name} / ${child.name}.`;
    }
  } catch (error) {
    reply = error instanceof AppError ? error.message : "No pude completar la acción.";
  }

  await providers.messaging.append({
    conversationId: conversation.id,
    authorId: null,
    documentId: conversation.activeDocumentId,
    role: "assistant",
    body: reply,
    intent: intent.type,
  });
  return { reply, intent: intent.type };
}

export async function addCategory(
  db: Db,
  actor: Actor,
  input: { companyId: string; parentId: string | null; name: string },
) {
  assertCompanyAccess(actor, input.companyId);
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("El nombre de la categoría es demasiado corto.", 400, "NAME_REQUIRED");
  if (input.parentId) {
    const parent = await db.accountingCategory.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.companyId !== input.companyId || parent.parentId) {
      throw new AppError("La subcategoría tiene que depender de una categoría de esta empresa.", 400, "CATEGORY_INVALID");
    }
  }
  await db.accountingCategory.create({
    data: { id: nid("cat"), companyId: input.companyId, parentId: input.parentId, name },
  });
}

export async function renameCategory(db: Db, actor: Actor, categoryId: string, name: string) {
  const category = await db.accountingCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError("No existe esa categoría.", 404, "NOT_FOUND");
  assertCompanyAccess(actor, category.companyId);
  const next = name.trim();
  if (next.length < 2) throw new AppError("El nombre de la categoría es demasiado corto.", 400, "NAME_REQUIRED");
  await db.accountingCategory.update({ where: { id: categoryId }, data: { name: next } });
}

export async function operationSnapshot(db: Db, actor: Actor, companyId: string) {
  assertCompanyAccess(actor, companyId);
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("No existe esa empresa.", 404, "NOT_FOUND");
  return { id: company.id, name: company.name, industry: company.industry };
}

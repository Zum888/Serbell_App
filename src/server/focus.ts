import { dayKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { isPendingMovement, rankSuggestions, type FocusSuggestion } from "@/lib/focus";
import { normalizeMerchant } from "@/lib/matching";
import { assertCanMutate, assertCompanyAccess, canReview, type Actor } from "@/lib/permissions";
import type { Db } from "@/server/db";
import { changeClassification, confirmLink } from "@/server/domain";
import { nid } from "@/server/ids";

async function audit(
  db: Db,
  input: {
    companyId: string;
    actorId: string;
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
      actorId: input.actorId,
      transactionId: input.transactionId ?? null,
      documentId: input.documentId ?? null,
      action: input.action,
      previousJson: input.previous === undefined ? null : JSON.stringify(input.previous),
      nextJson: input.next === undefined ? null : JSON.stringify(input.next),
      justification: input.justification ?? null,
    },
  });
}

async function companyMovements(db: Db, companyId: string) {
  return db.bankTransaction.findMany({
    where: { companyId },
    include: {
      classification: { include: { category: true, subcategory: true } },
      account: true,
      links: { where: { status: "confirmed" }, include: { document: { include: { extraction: true } } } },
    },
    orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
  });
}

function labelOf(category: { name: string } | null | undefined, subcategory: { name: string } | null | undefined) {
  if (!category || !subcategory) return "";
  return `${category.name} / ${subcategory.name}`;
}

export async function focusQueue(db: Db, actor: Actor, companyId: string, actualId?: string | null) {
  assertCompanyAccess(actor, companyId);
  const rows = await companyMovements(db, companyId);
  const pending = rows.filter((row) => isPendingMovement(row));
  const current = pending.find((row) => row.id === actualId) ?? pending[0] ?? null;
  const categories = await db.accountingCategory.findMany({ where: { companyId } });
  const byId = new Map(categories.map((category) => [category.id, category]));
  const history = rows.flatMap((row) => {
    const subcategoryId = row.classification?.subcategoryId;
    const label = labelOf(row.classification?.category, row.classification?.subcategory);
    if (!subcategoryId || !label) return [];
    return [{
      id: row.id,
      merchant: row.merchant,
      amountCents: row.amountCents,
      subcategoryId,
      label,
      postedOn: dayKey(row.postedOn) ?? "",
    }];
  });
  const storedRules = await db.classificationRule.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  const merchantById = new Map(rows.map((row) => [row.id, row]));
  const rules = storedRules.flatMap((rule) => {
    const source = rule.transactionId ? merchantById.get(rule.transactionId) : undefined;
    if (!source) return [];
    let parsed: { subcategoryId?: string; categoryName?: string; subcategoryName?: string } = {};
    try {
      parsed = JSON.parse(rule.afterJson) as typeof parsed;
    } catch {
      return [];
    }
    const subcategory = parsed.subcategoryId ? byId.get(parsed.subcategoryId) : undefined;
    const parent = subcategory?.parentId ? byId.get(subcategory.parentId) : undefined;
    const label = parent && subcategory ? `${parent.name} / ${subcategory.name}` : parsed.categoryName && parsed.subcategoryName ? `${parsed.categoryName} / ${parsed.subcategoryName}` : "";
    if (!parsed.subcategoryId || !label || subcategory?.companyId !== companyId) return [];
    return [{
      merchant: source.merchant,
      subcategoryId: parsed.subcategoryId,
      label,
      postedOn: dayKey(source.postedOn) ?? "",
    }];
  });
  let suggestions: FocusSuggestion[] = [];
  let ticket: {
    document: { id: string; fileName: string; mimeType: string } | null;
    suggested: boolean;
    linkable: boolean;
    note: string;
  } | null = null;
  let choices: { id: string; fileName: string; merchant: string | null; amountCents: number | null }[] = [];
  let merchantPending = 0;
  if (current) {
    const candidates = await db.matchCandidate.findMany({
      where: { transactionId: current.id, blocked: false },
      include: { document: { include: { extraction: true } } },
      orderBy: { createdAt: "asc" },
    });
    const linked = current.links[0]?.document ?? null;
    const suggested = candidates.find((candidate) => candidate.decision === "reliable") ?? candidates[0] ?? null;
    const shown = linked ?? suggested?.document ?? null;
    const openForDocument = suggested
      ? await db.matchCandidate.count({ where: { documentId: suggested.documentId, blocked: false } })
      : 0;
    const linkable = Boolean(
      !linked &&
        suggested &&
        suggested.decision === "reliable" &&
        openForDocument === 1 &&
        suggested.document.extraction?.verifiedAt,
    );
    const extractionSource = shown?.extraction;
    const extractionCategory = extractionSource?.subcategoryId ? byId.get(extractionSource.subcategoryId) : undefined;
    const extractionParent = extractionCategory?.parentId ? byId.get(extractionCategory.parentId) : undefined;
    const extraction = extractionCategory && extractionParent && extractionCategory.companyId === companyId
      ? { subcategoryId: extractionCategory.id, label: `${extractionParent.name} / ${extractionCategory.name}` }
      : null;
    suggestions = rankSuggestions({
      transactionId: current.id,
      merchant: current.merchant,
      amountCents: current.amountCents,
      history,
      rules,
      extraction,
    });
    ticket = {
      document: shown ? { id: shown.id, fileName: shown.fileName, mimeType: shown.mimeType } : null,
      suggested: Boolean(!linked && shown),
      linkable,
      note: linked
        ? "El comprobante ya está vinculado. Confirmar no vuelve a vincularlo ni concilia el banco."
        : linkable
          ? "El comprobante coincide con este movimiento. Enter confirma el vínculo y la categoría."
          : shown
            ? "Hay un comprobante sugerido, pero no es una coincidencia única. Enter no elige uno."
            : "No hay un comprobante sugerido. Puedes cambiar el ticket; Enter solo guarda la categoría.",
    };
    const documents = await db.document.findMany({
      where: { companyId },
      include: {
        extraction: true,
        links: { where: { status: "confirmed" }, select: { transactionId: true } },
      },
      orderBy: { fileName: "asc" },
    });
    choices = documents
      .filter((document) => document.id !== shown?.id)
      .filter((document) => !document.links.some((link) => link.transactionId !== current.id))
      .map((document) => ({
        id: document.id,
        fileName: document.fileName,
        merchant: document.extraction?.merchant ?? null,
        amountCents: document.extraction?.amountCents ?? null,
      }));
    const merchant = normalizeMerchant(current.merchant);
    merchantPending = pending.filter((row) => normalizeMerchant(row.merchant) === merchant).length;
  }
  const index = current ? pending.findIndex((row) => row.id === current.id) : -1;
  return {
    total: rows.length,
    pending: pending.length,
    pendingIds: pending.map((row) => row.id),
    position: index + 1,
    nextId: index === -1 ? pending[0]?.id ?? null : pending[(index + 1) % pending.length]?.id ?? null,
    merchantPending,
    suggestions,
    ticket,
    choices,
    current: current
      ? {
          id: current.id,
          merchant: current.merchant,
          description: current.description,
          postedOn: dayKey(current.postedOn) ?? "",
          amountCents: current.amountCents,
          institution: current.account.institution,
          mask: current.account.mask,
          categoryLabel: labelOf(current.classification?.category, current.classification?.subcategory) || "Sin categoría",
          accountingState: current.accountingState,
          documentState: current.documentState,
          reviewState: current.reviewState,
          reconciliationState: current.reconciliationState,
          sealed: Boolean(current.sealedAt),
        }
      : null,
  };
}

async function requireOpen(db: Db, actor: Actor, transactionId: string) {
  const transaction = await db.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new AppError("No existe ese movimiento.", 404, "NOT_FOUND");
  assertCanMutate(actor, transaction.companyId, transaction.sealedAt);
  return transaction;
}

export async function confirmFocus(
  db: Db,
  actor: Actor,
  transactionId: string,
  input: { subcategoryId: string; documentId?: string | null; justification?: string | null },
) {
  const transaction = await requireOpen(db, actor, transactionId);
  const before = {
    reconciliationState: transaction.reconciliationState,
    reviewState: transaction.reviewState,
    accountingState: transaction.accountingState,
    documentState: transaction.documentState,
  };
  if (input.documentId) {
    await confirmLink(db, actor, input.documentId, transactionId);
  }
  await changeClassification(db, actor, transactionId, {
    subcategoryId: input.subcategoryId,
    justification: input.justification ?? undefined,
  });
  const after = await db.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!after) return;
  if (after.reconciliationState !== before.reconciliationState) {
    await db.bankTransaction.update({ where: { id: transactionId }, data: { reconciliationState: before.reconciliationState } });
  }
  if (after.reviewState === "Approved" && before.reviewState !== "Approved") {
    await db.bankTransaction.update({ where: { id: transactionId }, data: { reviewState: before.reviewState } });
  }
}

export async function applyMerchantCategory(
  db: Db,
  actor: Actor,
  transactionId: string,
  input: { subcategoryId: string; justification?: string | null },
) {
  const current = await requireOpen(db, actor, transactionId);
  const rows = await companyMovements(db, current.companyId);
  const merchant = normalizeMerchant(current.merchant);
  const targets = rows.filter((row) => isPendingMovement(row) && normalizeMerchant(row.merchant) === merchant);
  if (!targets.length) throw new AppError("No hay movimientos pendientes de este comercio.", 400, "NONE");
  const subcategory = await db.accountingCategory.findUnique({ where: { id: input.subcategoryId }, include: { parent: true } });
  if (!subcategory?.parentId || !subcategory.parent || subcategory.companyId !== current.companyId) {
    throw new AppError("La subcategoría no pertenece a esta empresa o no depende de una categoría.", 400, "CATEGORY_INVALID");
  }
  const justification = input.justification?.trim() || null;
  const needsChange = targets.some((row) => row.classification?.subcategoryId !== subcategory.id);
  if (canReview(actor, current.companyId) && needsChange && (!justification || justification.length < 8)) {
    throw new AppError("La corrección del contador necesita una justificación.", 400, "JUSTIFICATION_REQUIRED");
  }
  const changed: string[] = [];
  for (const row of targets) {
    if (row.sealedAt) continue;
    const previous = row.classification?.subcategoryId ?? null;
    await changeClassification(db, actor, row.id, { subcategoryId: subcategory.id, justification: justification ?? undefined });
    if (previous !== subcategory.id) changed.push(row.id);
  }
  const after = {
    merchant: current.merchant,
    subcategoryId: subcategory.id,
    categoryName: subcategory.parent.name,
    subcategoryName: subcategory.name,
    transactionIds: targets.map((row) => row.id),
    changed,
  };
  await db.classificationRule.create({
    data: {
      id: nid("rule"),
      companyId: current.companyId,
      actorId: actor.id,
      transactionId: current.id,
      beforeJson: JSON.stringify({ merchant: current.merchant, pending: targets.map((row) => row.id) }),
      afterJson: JSON.stringify(after),
      justification: justification ?? `Categoría aplicada a ${targets.length} movimientos pendientes de ${current.merchant}.`,
      applied: true,
    },
  });
  await audit(db, {
    companyId: current.companyId,
    actorId: actor.id,
    transactionId: current.id,
    action: "classification_rule_applied",
    previous: { merchant: current.merchant, pending: targets.length },
    next: after,
    justification: justification ?? undefined,
  });
  return after;
}

export async function skipFocus(db: Db, actor: Actor, transactionId: string) {
  const transaction = await requireOpen(db, actor, transactionId);
  const snapshot = {
    accountingState: transaction.accountingState,
    documentState: transaction.documentState,
    reviewState: transaction.reviewState,
    reconciliationState: transaction.reconciliationState,
  };
  await audit(db, {
    companyId: transaction.companyId,
    actorId: actor.id,
    transactionId,
    action: "focus_skipped",
    previous: snapshot,
    next: snapshot,
  });
}

export async function nextFocusPath(db: Db, actor: Actor, transactionId: string) {
  const transaction = await db.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return "/movimientos?vista=enfoque";
  assertCompanyAccess(actor, transaction.companyId);
  const queue = await focusQueue(db, actor, transaction.companyId, transactionId);
  const nextId = queue.current?.id === transactionId ? queue.nextId : queue.current?.id ?? queue.pendingIds[0] ?? null;
  return nextId ? `/movimientos?vista=enfoque&actual=${nextId}` : "/movimientos?vista=enfoque";
}

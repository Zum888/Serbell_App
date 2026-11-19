import { documentColumn, reviewColumn, type DocumentColumn, type ReviewColumn } from "@/lib/board";
import { dayKey, formatDateTime, formatDay } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { AUDIT_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/money";
import { canReview, companyRole, type Actor, type MembershipRole } from "@/lib/permissions";
import { localProviders } from "@/providers/local";
import type { Db } from "@/server/db";

export function documentChangeNote(action: string, previousJson: string | null, nextJson: string | null): string | null {
  if (action !== "document_replaced") return null;
  try {
    const previous = previousJson ? (JSON.parse(previousJson) as { fileName?: string | null }) : null;
    const next = nextJson ? (JSON.parse(nextJson) as { fileName?: string | null }) : null;
    const before = previous?.fileName || "Sin comprobante";
    const after = next?.fileName || "—";
    return `Antes: ${before}. Ahora: ${after}.`;
  } catch {
    return null;
  }
}

const roleOf = (value: string): MembershipRole => {
  if (value === "BUSINESS_OWNER" || value === "ACCOUNTANT" || value === "FIRM_ADMIN") return value;
  return "BUSINESS_OWNER";
};

export async function loadActor(db: Db, userId: string): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { memberships: true, firmMemberships: true },
  });
  if (!user) return null;
  const firmRole = user.firmMemberships.some((membership) => membership.role === "FIRM_ADMIN")
    ? "FIRM_ADMIN"
    : user.firmMemberships.some((membership) => membership.role === "ACCOUNTANT")
      ? "ACCOUNTANT"
      : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    firmRole,
    memberships: user.memberships.map((membership) => ({
      companyId: membership.companyId,
      role: roleOf(membership.role),
    })),
  };
}

export async function getShell(db: Db, actor: Actor) {
  const companies = await db.company.findMany({
    where: { id: { in: actor.memberships.map((membership) => membership.companyId) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, industry: true },
  });
  return { actor, companies };
}

export async function getHome(db: Db, actor: Actor, companyId: string) {
  const role = companyRole(actor, companyId);
  if (!role) throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("No existe esa empresa.", 404, "NOT_FOUND");
  const accounts = await localProviders(db).bank.listAccounts(companyId);
  const balanceCents = accounts.reduce((sum, account) => sum + account.availableBalanceCents, 0);
  return {
    company,
    role,
    accounts,
    balanceCents,
    accountCount: accounts.length,
  };
}

function movementWhere(filter: string) {
  if (filter === "sin-categoria") return { accountingState: "Uncategorized" };
  if (filter === "sin-comprobante") return { documentState: "Missing" };
  if (filter === "por-conciliar") return { reconciliationState: "Unreconciled" };
  if (filter === "por-revisar") return { reviewState: "NeedsReview" };
  if (filter === "aprobados") return { reviewState: "Approved" };
  return {};
}

export async function listMovements(db: Db, actor: Actor, companyId: string, filter: string, q: string, accountId?: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.bankTransaction.findMany({
    where: { companyId, ...movementWhere(filter), ...(accountId ? { accountId } : {}) },
    include: {
      classification: { include: { category: true, subcategory: true } },
      account: true,
      audits: { where: { action: "serbell_matched" }, select: { id: true } },
      links: {
        where: { status: "confirmed" },
        include: { document: { select: { id: true, fileName: true } } },
      },
      invoiceLinks: {
        where: { status: "confirmed" },
        include: { invoice: { select: { number: true } } },
        take: 1,
      },
      messages: { where: { intent: "comment" }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
    orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
  });
  const needle = q.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (!needle) return true;
      const amount = (Math.abs(row.amountCents) / 100).toFixed(2);
      return (
        row.merchant.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle) ||
        amount.includes(needle)
      );
    })
    .map((row) => ({
      id: row.id,
      postedOn: dayKey(row.postedOn) ?? "",
      merchant: row.merchant,
      description: row.description,
      amountCents: row.amountCents,
      category: row.classification?.category?.name ?? null,
      subcategory: row.classification?.subcategory?.name ?? null,
      subcategoryId: row.classification?.subcategoryId ?? "",
      documentState: row.documentState,
      reviewState: row.reviewState,
      reconciliationState: row.reconciliationState,
      serbellConciled: row.audits.length > 0,
      sealed: Boolean(row.sealedAt),
      institution: row.account.institution,
      mask: row.account.mask,
      documentId: row.links[0]?.document.id ?? null,
      documentName: row.links[0]?.document.fileName ?? null,
      invoiceNumber: row.invoiceLinks[0]?.invoice.number ?? null,
      comment: row.messages[0]?.body ?? null,
      suggested: row.classification?.state === "Proposed",
    }));
}

export async function movementCounts(db: Db, actor: Actor, companyId: string, accountId?: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.bankTransaction.findMany({
    where: { companyId, ...(accountId ? { accountId } : {}) },
    select: { accountingState: true, documentState: true, reviewState: true, reconciliationState: true },
  });
  return {
    todos: rows.length,
    sinCategoria: rows.filter((row) => row.accountingState === "Uncategorized").length,
    sinComprobante: rows.filter((row) => row.documentState === "Missing").length,
    porConciliar: rows.filter((row) => row.reconciliationState !== "Reconciled").length,
    porRevisar: rows.filter((row) => row.reviewState === "NeedsReview").length,
    aprobados: rows.filter((row) => row.reviewState === "Approved").length,
  };
}

export async function getMovement(db: Db, actor: Actor, transactionId: string) {
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: {
      account: true,
      company: true,
      classification: { include: { category: true, subcategory: true } },
      links: { where: { status: "confirmed" }, include: { document: { include: { extraction: true } } } },
      candidates: { include: { document: true } },
      journalEntry: { include: { lines: true } },
      audits: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!transaction) return null;
  if (!companyRole(actor, transaction.companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const link = transaction.links[0] ?? null;
  const documentIds = [
    link?.documentId,
    ...transaction.messages.map((message) => message.documentId),
  ].filter((id): id is string => Boolean(id));
  const extraMessages = documentIds.length
    ? await db.message.findMany({
        where: { documentId: { in: documentIds }, id: { notIn: transaction.messages.map((message) => message.id) } },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const messages = [...extraMessages, ...transaction.messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const categories = await localProviders(db).accounting.listCategories(transaction.companyId);
  const parents = new Map(categories.filter((category) => !category.parentId).map((category) => [category.id, category.name]));
  const pairs = categories
    .filter((category) => category.parentId && parents.has(category.parentId))
    .map((category) => ({
      subcategoryId: category.id,
      label: `${parents.get(category.parentId ?? "")} / ${category.name}`,
    }));
  return {
    id: transaction.id,
    companyId: transaction.companyId,
    companyName: transaction.company.name,
    merchant: transaction.merchant,
    description: transaction.description,
    postedOn: formatDay(dayKey(transaction.postedOn)),
    amountCents: transaction.amountCents,
    institution: transaction.account.institution,
    productName: transaction.account.productName,
    mask: transaction.account.mask,
    documentState: transaction.documentState,
    reviewState: transaction.reviewState,
    accountingState: transaction.accountingState,
    reconciliationState: transaction.reconciliationState,
    serbellConciled: transaction.audits.some((event) => event.action === "serbell_matched"),
    bankState: transaction.bankState,
    sealed: Boolean(transaction.sealedAt),
    sealedAt: transaction.sealedAt ? formatDateTime(transaction.sealedAt) : null,
    subcategoryId: transaction.classification?.subcategoryId ?? "",
    categoryLabel: transaction.classification?.category && transaction.classification.subcategory
      ? `${transaction.classification.category.name} / ${transaction.classification.subcategory.name}`
      : "Sin categoría",
    pairs,
    catalog: [...new Set(categories.map((category) => category.name))].sort((a, b) => a.localeCompare(b, "es")),
    journal: transaction.journalEntry
      ? {
          lines: [...transaction.journalEntry.lines]
            .sort((a, b) => b.debitCents - a.debitCents || a.accountName.localeCompare(b.accountName))
            .map((line) => ({
              id: line.id,
              accountName: line.accountName,
              debitCents: line.debitCents,
              creditCents: line.creditCents,
            })),
        }
      : null,
    canReview: canReview(actor, transaction.companyId),
    canReopen: actor.firmRole === "FIRM_ADMIN",
    document: link
      ? {
          id: link.document.id,
          fileName: link.document.fileName,
          mimeType: link.document.mimeType,
          merchant: link.document.extraction?.merchant ?? null,
          amountCents: link.document.extraction?.amountCents ?? null,
          occurredOn: formatDay(dayKey(link.document.extraction?.occurredOn)),
          notice: link.document.extraction?.notice ?? null,
          isDemonstration: link.document.extraction?.isDemonstration ?? false,
        }
      : null,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      body: message.body,
      author: message.author?.name ?? "Serbell",
      at: formatDateTime(message.createdAt),
    })),
    history: transaction.audits.map((event) => ({
      id: event.id,
      action: AUDIT_LABEL[event.action] ?? event.action,
      actor: event.actor?.name ?? "Sistema",
      at: formatDateTime(event.createdAt),
      justification: event.justification,
      note: documentChangeNote(event.action, event.previousJson, event.nextJson),
    })),
  };
}

export async function getReceiptContext(db: Db, actor: Actor, transactionId: string) {
  const transaction = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    include: {
      links: { where: { status: "confirmed" }, include: { document: true } },
      audits: { where: { action: "document_replaced" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!transaction) throw new AppError("No existe ese movimiento.", 404, "NOT_FOUND");
  if (!companyRole(actor, transaction.companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const documents = await db.document.findMany({
    where: { companyId: transaction.companyId },
    include: {
      extraction: true,
      links: { where: { status: "confirmed" }, select: { transactionId: true } },
    },
    orderBy: { fileName: "asc" },
  });
  const link = transaction.links[0] ?? null;
  const audit = transaction.audits[0] ?? null;
  return {
    transactionId: transaction.id,
    merchant: transaction.merchant,
    amountCents: transaction.amountCents,
    sealed: Boolean(transaction.sealedAt),
    document: link
      ? { id: link.document.id, fileName: link.document.fileName, mimeType: link.document.mimeType }
      : null,
    choices: documents
      .filter((document) => document.id !== link?.documentId)
      .filter((document) => !document.links.some((item) => item.transactionId !== transaction.id))
      .map((document) => ({
        id: document.id,
        fileName: document.fileName,
        merchant: document.extraction?.merchant ?? null,
        amountCents: document.extraction?.amountCents ?? null,
      })),
    auditNote: audit ? documentChangeNote(audit.action, audit.previousJson, audit.nextJson) : null,
  };
}

export async function getChat(db: Db, actor: Actor, companyId: string, documentId?: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("No existe esa empresa.", 404, "NOT_FOUND");
  const conversation = await db.conversation.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    include: { messages: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  const selectedId = documentId || conversation?.activeDocumentId || null;
  const document = selectedId
    ? await db.document.findFirst({
        where: { id: selectedId, companyId },
        include: {
          extraction: true,
          candidates: true,
          links: { where: { status: "confirmed" } },
        },
      })
    : null;
  const transactions = document
    ? await db.bankTransaction.findMany({
        where: { id: { in: document.candidates.map((candidate) => candidate.transactionId) } },
      })
    : [];
  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const decision = document?.candidates[0]?.decision ?? null;
  const proposed = document?.candidates.find((candidate) => !candidate.blocked && decision === "reliable");
  const linked = document?.links[0]
    ? await db.bankTransaction.findUnique({ where: { id: document.links[0].transactionId } })
    : null;
  return {
    companyName: company.name,
    messages: (conversation?.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      body: message.body,
      author: message.author?.name ?? "Serbell",
      at: formatDateTime(message.createdAt),
    })),
    document: document
      ? {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          status: document.status,
          notice: document.extraction?.notice ?? "",
          isDemonstration: document.extraction?.isDemonstration ?? false,
          merchant: document.extraction?.merchant ?? "",
          amountCents: document.extraction?.amountCents ?? null,
          occurredOn: dayKey(document.extraction?.occurredOn) ?? "",
          occurredLabel: formatDay(dayKey(document.extraction?.occurredOn)),
          verified: Boolean(document.extraction?.verifiedAt),
          decision,
          reasonsFor: proposed ? (JSON.parse(proposed.reasonsForJson) as string[]) : [],
          reasonsAgainst: document.candidates[0]
            ? (JSON.parse(document.candidates[0].reasonsAgainstJson) as string[])
            : [],
          linkedTransactionId: document.links[0]?.transactionId ?? null,
          linkedReview: linked?.reviewState ?? null,
          linkedSealed: Boolean(linked?.sealedAt),
          proposedTransactionId: proposed?.transactionId ?? null,
          candidates: document.candidates.map((candidate) => {
            const transaction = byId.get(candidate.transactionId);
            return {
              transactionId: candidate.transactionId,
              merchant: transaction?.merchant ?? "Movimiento",
              postedOn: formatDay(dayKey(transaction?.postedOn)),
              amountCents: transaction ? Math.abs(transaction.amountCents) : 0,
              blocked: candidate.blocked,
              reasonsFor: JSON.parse(candidate.reasonsForJson) as string[],
              reasonsAgainst: JSON.parse(candidate.reasonsAgainstJson) as string[],
            };
          }),
        }
      : null,
  };
}

export async function getFirm(db: Db, actor: Actor) {
  if (!actor.firmRole) {
    throw new AppError("Esta pantalla es del despacho.", 403, "FIRM_FORBIDDEN");
  }
  const companies = await db.company.findMany({
    where: { id: { in: actor.memberships.map((membership) => membership.companyId) } },
    include: { transactions: true, documents: true, tasks: true },
    orderBy: { name: "asc" },
  });
  const rows = companies.map((company) => ({
    id: company.id,
    name: company.name,
    industry: company.industry,
    awaitingReview: company.transactions.filter((transaction) => transaction.reviewState === "NeedsReview").length,
    pendingReceipts: company.transactions.filter((transaction) => transaction.documentState === "Missing").length,
    clarifications: company.tasks.filter((task) => task.kind === "clarification" && task.status === "open").length,
    readyToApprove: company.transactions.filter(
      (transaction) => transaction.reviewState === "NeedsReview" && transaction.documentState === "Linked" && !transaction.sealedAt,
    ).length,
    duplicates: company.documents.filter((document) => document.status === "duplicate" || document.duplicateOfId).length,
  }));
  return {
    assigned: rows.length,
    awaitingReview: rows.reduce((sum, row) => sum + row.awaitingReview, 0),
    pendingReceipts: rows.reduce((sum, row) => sum + row.pendingReceipts, 0),
    clarifications: rows.reduce((sum, row) => sum + row.clarifications, 0),
    readyToApprove: rows.reduce((sum, row) => sum + row.readyToApprove, 0),
    duplicates: rows.reduce((sum, row) => sum + row.duplicates, 0),
    companies: rows,
  };
}

export async function firmQueue(db: Db, actor: Actor, tipo: string) {
  if (!actor.firmRole) {
    throw new AppError("Esta pantalla es del despacho.", 403, "FIRM_FORBIDDEN");
  }
  const companyIds = actor.memberships.map((membership) => membership.companyId);
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    orderBy: { name: "asc" },
  });
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  if (tipo === "empresas") {
    return companies.map((company) => ({
      id: company.id,
      companyId: company.id,
      companyName: company.name,
      title: company.name,
      detail: company.industry,
      href: `/api/session/company?companyId=${company.id}&next=${encodeURIComponent("/movimientos")}`,
    }));
  }
  if (tipo === "aclaraciones") {
    const tasks = await db.task.findMany({
      where: { companyId: { in: companyIds }, kind: "clarification", status: "open" },
      orderBy: [{ company: { name: "asc" } }, { createdAt: "asc" }],
    });
    return tasks.map((task) => ({
      id: task.id,
      companyId: task.companyId,
      companyName: companyName.get(task.companyId) ?? "",
      title: task.title,
      detail: "Aclaración abierta",
      href: task.transactionId
        ? `/api/session/company?companyId=${task.companyId}&next=${encodeURIComponent(`/movimientos?movimiento=${task.transactionId}`)}`
        : `/api/session/company?companyId=${task.companyId}&next=${encodeURIComponent("/movimientos")}`,
    }));
  }
  if (tipo === "duplicados") {
    const documents = await db.document.findMany({
      where: {
        companyId: { in: companyIds },
        OR: [{ duplicateOfId: { not: null } }, { status: "duplicate" }],
      },
      include: { extraction: true, duplicateOf: true },
      orderBy: [{ company: { name: "asc" } }, { fileName: "asc" }],
    });
    return documents.map((document) => ({
      id: document.id,
      companyId: document.companyId,
      companyName: companyName.get(document.companyId) ?? "",
      title: document.fileName,
      detail: document.duplicateOf?.fileName
        ? `Copia de ${document.duplicateOf.fileName}${document.extraction?.merchant ? ` · ${document.extraction.merchant}` : ""}`
        : document.extraction?.merchant ?? "Comprobante duplicado",
      href: `/api/session/company?companyId=${document.companyId}&next=${encodeURIComponent(`/comprobantes?foco=${document.id}`)}`,
    }));
  }
  const where =
    tipo === "comprobantes"
      ? { documentState: "Missing" }
      : tipo === "aprobar"
        ? { reviewState: "NeedsReview", documentState: "Linked", sealedAt: null }
        : { reviewState: "NeedsReview" };
  const transactions = await db.bankTransaction.findMany({
    where: { companyId: { in: companyIds }, ...where },
    orderBy: [{ company: { name: "asc" } }, { postedOn: "desc" }, { merchant: "asc" }],
  });
  return transactions.map((transaction) => ({
    id: transaction.id,
    companyId: transaction.companyId,
    companyName: companyName.get(transaction.companyId) ?? "",
    title: transaction.merchant,
    detail: `${formatDay(dayKey(transaction.postedOn))} · ${transaction.amountCents < 0 ? "−" : ""}${(Math.abs(transaction.amountCents) / 100).toFixed(2)}`,
    href: `/api/session/company?companyId=${transaction.companyId}&next=${encodeURIComponent(`/movimientos?movimiento=${transaction.id}`)}`,
  }));
}

function requireCompany(actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
}

const movementInclude = {
  classification: { include: { category: true, subcategory: true } },
} as const;

export type ClassifiedMovement = {
  id: string;
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
  category: string;
  subcategory: string;
};

async function classifiedMovements(db: Db, actor: Actor, companyId: string, direction: "in" | "out"): Promise<ClassifiedMovement[]> {
  requireCompany(actor, companyId);
  const rows = await db.bankTransaction.findMany({
    where: { companyId, amountCents: direction === "out" ? { lt: 0 } : { gt: 0 } },
    include: movementInclude,
    orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    postedOn: formatDay(dayKey(row.postedOn)),
    merchant: row.merchant,
    description: row.description,
    amountCents: row.amountCents,
    category: row.classification?.category?.name ?? "Sin categoría",
    subcategory: row.classification?.subcategory?.name ?? "Sin subcategoría",
  }));
}

export async function expenseAnalysis(db: Db, actor: Actor, companyId: string) {
  const rows = await classifiedMovements(db, actor, companyId, "out");
  const groups = new Map<string, { category: string; subcategory: string; totalCents: number; count: number }>();
  for (const row of rows) {
    const key = `${row.category}\n${row.subcategory}`;
    const current = groups.get(key) ?? { category: row.category, subcategory: row.subcategory, totalCents: 0, count: 0 };
    current.totalCents += Math.abs(row.amountCents);
    current.count += 1;
    groups.set(key, current);
  }
  const grouped = [...groups.values()].sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));
  const totalCents = grouped.reduce((sum, group) => sum + group.totalCents, 0);
  return { rows, grouped, totalCents };
}

export async function incomingMovements(db: Db, actor: Actor, companyId: string) {
  const rows = await classifiedMovements(db, actor, companyId, "in");
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const tasks = await db.task.findMany({
    where: { companyId, status: "open" },
    orderBy: { createdAt: "asc" },
  });
  return { rows, totalCents, openTasks: tasks.map((task) => ({ id: task.id, title: task.title, kind: task.kind })) };
}

export async function accountBreakdowns(db: Db, actor: Actor, companyId: string) {
  requireCompany(actor, companyId);
  const accounts = await db.bankAccount.findMany({
    where: { companyId },
    orderBy: [{ institution: "asc" }, { mask: "asc" }],
  });
  const transactions = await db.bankTransaction.findMany({
    where: { companyId },
    include: {
      classification: { include: { category: true, subcategory: true } },
      links: { where: { status: "confirmed" }, include: { document: { select: { id: true, fileName: true } } } },
    },
    orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
  });
  return accounts.map((account) => {
    const rows = transactions.filter((row) => row.accountId === account.id);
    let inflows = 0;
    let outflows = 0;
    for (const row of rows) {
      if (row.amountCents > 0) inflows += row.amountCents;
      else if (row.amountCents < 0) outflows += row.amountCents;
    }
    return {
      id: account.id,
      institution: account.institution,
      productName: account.productName,
      name: account.name,
      mask: account.mask,
      currency: account.currency,
      kind: account.kind,
      isDemonstration: account.isDemonstration,
      availableBalanceCents: account.availableBalanceCents,
      inflows,
      outflows,
      net: inflows + outflows,
      reconciledCount: rows.filter((row) => row.reconciliationState === "Reconciled").length,
      unreconciledCount: rows.filter((row) => row.reconciliationState !== "Reconciled").length,
      origin: account.origin,
      movements: rows.map((row) => ({
        id: row.id,
        day: dayKey(row.postedOn) ?? "",
        postedOn: formatDay(dayKey(row.postedOn)),
        merchant: row.merchant,
        description: row.description,
        amountCents: row.amountCents,
        isDemonstration: row.isDemonstration,
        reconciliationState: row.reconciliationState,
        documentState: row.documentState,
        accountingState: row.accountingState,
        reviewState: row.reviewState,
        sealed: Boolean(row.sealedAt),
        categoryLabel: row.classification?.category && row.classification.subcategory
          ? `${row.classification.category.name} / ${row.classification.subcategory.name}`
          : "Sin categoría",
        documentName: row.links[0]?.document.fileName ?? null,
      })),
      series: [...rows]
        .sort((a, b) => a.postedOn.getTime() - b.postedOn.getTime() || a.merchant.localeCompare(b.merchant))
        .map((row) => row.amountCents),
    };
  });
}

export async function bankSummary(db: Db, actor: Actor, companyId: string) {
  requireCompany(actor, companyId);
  const rows = await db.bankTransaction.findMany({
    where: { companyId },
    include: movementInclude,
  });
  let inflows = 0;
  let outflows = 0;
  for (const row of rows) {
    if (row.amountCents > 0) inflows += row.amountCents;
    if (row.amountCents < 0) outflows += row.amountCents;
  }
  return { count: rows.length, inflows, outflows, net: inflows + outflows };
}

export type ReportPoint = { day: string; inflows: number; outflows: number; net: number };

export type ReportPeriod = {
  from: string;
  to: string;
  inflows: number;
  outflows: number;
  net: number;
  count: number;
};

export async function companyReport(db: Db, actor: Actor, companyId: string) {
  requireCompany(actor, companyId);
  const [accounts, transactions, duplicateRows] = await Promise.all([
    db.bankAccount.findMany({
      where: { companyId },
      orderBy: [{ institution: "asc" }, { mask: "asc" }],
    }),
    db.bankTransaction.findMany({
      where: { companyId },
      include: {
        classification: { include: { category: true, subcategory: true } },
        account: true,
      },
      orderBy: [{ postedOn: "asc" }, { merchant: "asc" }],
    }),
    db.document.findMany({
      where: { companyId, duplicateOfId: { not: null } },
      include: { extraction: true, duplicateOf: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let inflows = 0;
  let outflows = 0;
  let uncategorizedCount = 0;
  let uncategorizedExpenseCents = 0;
  const byDay = new Map<string, { inflows: number; outflows: number }>();
  const byCategory = new Map<string, { category: string; totalCents: number; count: number }>();
  const byGroup = new Map<string, { category: string; subcategory: string; totalCents: number; count: number }>();

  for (const row of transactions) {
    const day = dayKey(row.postedOn) ?? "";
    const bucket = byDay.get(day) ?? { inflows: 0, outflows: 0 };
    if (row.amountCents > 0) {
      inflows += row.amountCents;
      bucket.inflows += row.amountCents;
    } else if (row.amountCents < 0) {
      outflows += Math.abs(row.amountCents);
      bucket.outflows += Math.abs(row.amountCents);
    }
    byDay.set(day, bucket);
    const uncategorized = row.accountingState === "Uncategorized" || !row.classification;
    if (uncategorized) {
      uncategorizedCount += 1;
      if (row.amountCents < 0) uncategorizedExpenseCents += Math.abs(row.amountCents);
    }
    if (row.amountCents < 0) {
      const category = row.classification?.category?.name ?? "Sin categoría";
      const subcategory = row.classification?.subcategory?.name ?? "Sin subcategoría";
      const categoryRow = byCategory.get(category) ?? { category, totalCents: 0, count: 0 };
      categoryRow.totalCents += Math.abs(row.amountCents);
      categoryRow.count += 1;
      byCategory.set(category, categoryRow);
      const key = `${category}\n${subcategory}`;
      const group = byGroup.get(key) ?? { category, subcategory, totalCents: 0, count: 0 };
      group.totalCents += Math.abs(row.amountCents);
      group.count += 1;
      byGroup.set(key, group);
    }
  }

  const days = [...byDay.keys()].filter(Boolean).sort();
  const daily: ReportPoint[] = days.length
    ? eachDay(days[0], days[days.length - 1]).map((day) => {
        const bucket = byDay.get(day) ?? { inflows: 0, outflows: 0 };
        return { day, inflows: bucket.inflows, outflows: bucket.outflows, net: bucket.inflows - bucket.outflows };
      })
    : [];

  const span = days.length >= 2 ? splitSpan(days[0], days[days.length - 1]) : null;
  const periodOf = (side: "early" | "late"): ReportPeriod | null => {
    if (!span) return null;
    const rows = transactions.filter((row) => {
      const key = dayKey(row.postedOn);
      if (!key) return false;
      const ms = Date.parse(`${key}T12:00:00.000Z`);
      return side === "early" ? ms < span.mid : ms >= span.mid;
    });
    if (rows.length === 0) return null;
    const keys = rows.map((row) => dayKey(row.postedOn)).filter((key): key is string => Boolean(key)).sort();
    let periodIn = 0;
    let periodOut = 0;
    for (const row of rows) {
      if (row.amountCents > 0) periodIn += row.amountCents;
      else if (row.amountCents < 0) periodOut += Math.abs(row.amountCents);
    }
    return {
      from: keys[0],
      to: keys[keys.length - 1],
      inflows: periodIn,
      outflows: periodOut,
      net: periodIn - periodOut,
      count: rows.length,
    };
  };

  const largestExpenses = [...transactions]
    .filter((row) => row.amountCents < 0)
    .sort((a, b) => a.amountCents - b.amountCents || a.merchant.localeCompare(b.merchant))
    .slice(0, 3)
    .map((row) => ({
      id: row.id,
      merchant: row.merchant,
      postedOn: formatDay(dayKey(row.postedOn)),
      amountCents: row.amountCents,
      category: row.classification?.category?.name ?? "Sin categoría",
      institution: row.account.institution,
      mask: row.account.mask,
      isDemonstration: row.account.isDemonstration || row.isDemonstration,
    }));

  return {
    count: transactions.length,
    inflows,
    outflows,
    net: inflows - outflows,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
    uncategorizedCount,
    uncategorizedExpenseCents,
    largestExpenses,
    categories: [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category)),
    groups: [...byGroup.values()].sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category)),
    daily,
    early: periodOf("early"),
    late: periodOf("late"),
    accounts: accounts.map((account) => {
      const rows = transactions.filter((row) => row.accountId === account.id);
      let accountIn = 0;
      let accountOut = 0;
      for (const row of rows) {
        if (row.amountCents > 0) accountIn += row.amountCents;
        else if (row.amountCents < 0) accountOut += Math.abs(row.amountCents);
      }
      return {
        id: account.id,
        institution: account.institution,
        productName: account.productName,
        mask: account.mask,
        kind: account.kind,
        isDemonstration: account.isDemonstration,
        availableBalanceCents: account.availableBalanceCents,
        inflows: accountIn,
        outflows: accountOut,
        net: accountIn - accountOut,
        count: rows.length,
        series: rows.map((row) => row.amountCents),
      };
    }),
    storedBalanceCents: accounts.reduce((sum, account) => sum + account.availableBalanceCents, 0),
    demonstrationAccountCount: accounts.filter((account) => account.isDemonstration).length,
    duplicates: duplicateRows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      merchant: row.extraction?.merchant ?? null,
      amountCents: row.extraction?.amountCents ?? null,
      originalName: row.duplicateOf?.fileName ?? null,
    })),
  };
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = Date.parse(`${from}T12:00:00.000Z`);
  const end = Date.parse(`${to}T12:00:00.000Z`);
  while (cursor <= end) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return days;
}

function splitSpan(first: string, last: string) {
  const start = Date.parse(`${first}T12:00:00.000Z`);
  const end = Date.parse(`${last}T12:00:00.000Z`);
  return { mid: start + Math.floor((end - start) / 2) };
}

export async function detectedDuplicates(db: Db, actor: Actor, companyId: string) {
  requireCompany(actor, companyId);
  const rows = await db.document.findMany({
    where: { companyId, duplicateOfId: { not: null } },
    include: { extraction: true, duplicateOf: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    merchant: row.extraction?.merchant ?? null,
    amountCents: row.extraction?.amountCents ?? null,
    occurredOn: formatDay(dayKey(row.extraction?.occurredOn)),
    originalId: row.duplicateOf?.id ?? null,
    originalName: row.duplicateOf?.fileName ?? null,
  }));
}

export async function companyProfile(db: Db, actor: Actor, companyId: string) {
  requireCompany(actor, companyId);
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { memberships: { include: { user: true }, orderBy: { user: { name: "asc" } } } },
  });
  if (!company) throw new AppError("No existe esa empresa.", 404, "NOT_FOUND");
  return {
    name: company.name,
    industry: company.industry,
    members: company.memberships.map((membership) => ({
      id: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
    })),
  };
}

export async function listDocuments(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.document.findMany({
    where: { companyId },
    include: { extraction: true, links: true, duplicateOf: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    status: row.status,
    merchant: row.extraction?.merchant ?? null,
    amountCents: row.extraction?.amountCents ?? null,
    occurredOn: formatDay(dayKey(row.extraction?.occurredOn)),
    linked: row.links.some((link) => link.status === "confirmed"),
    isDemonstration: row.extraction?.isDemonstration ?? false,
    duplicateOfName: row.duplicateOf?.fileName ?? null,
  }));
}

export async function listCategoryTree(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const categories = await localProviders(db).accounting.listCategories(companyId);
  type CategoryNode = { id: string; parentId: string | null; name: string; children: CategoryNode[] };
  const nest = (parentId: string | null): CategoryNode[] =>
    categories
      .filter((category) => category.parentId === parentId)
      .map((category) => ({ id: category.id, parentId: category.parentId, name: category.name, children: nest(category.id) }));
  return nest(null);
}

function moneyLabel(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "Sin importe" : formatUsd(cents);
}

export async function documentBoard(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.document.findMany({
    where: { companyId },
    include: {
      extraction: true,
      duplicateOf: true,
      links: { where: { status: "confirmed" }, include: { transaction: true } },
      candidates: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const groups: Record<DocumentColumn, {
    id: string;
    fileName: string;
    merchant: string;
    amountLabel: string;
    amountCents: number | null;
    dateLabel: string;
    day: string | null;
    duplicate: boolean;
    conflict: boolean;
    movement: { id: string; label: string } | null;
    suggestionLabel: string | null;
  }[]> = { recibido: [], procesado: [], listo: [], sellado: [] };
  for (const row of rows) {
    const link = row.links[0] ?? null;
    const transaction = link?.transaction ?? null;
    const duplicate = row.status === "duplicate" || Boolean(row.duplicateOfId);
    const conflict = row.status === "conflict" || row.candidates.some((candidate) => candidate.decision === "conflict");
    const hasSuggestion = row.candidates.length > 0 || row.status === "suggested" || row.status === "conflict";
    const column = documentColumn({
      linked: Boolean(transaction),
      sealed: Boolean(transaction?.sealedAt),
      reviewState: transaction?.reviewState ?? null,
      hasSuggestion,
      duplicate,
      conflict,
    });
    const merchant = transaction?.merchant || row.extraction?.merchant || row.fileName;
    const amountCents = transaction?.amountCents ?? row.extraction?.amountCents ?? null;
    const day = dayKey(transaction?.postedOn) ?? dayKey(row.extraction?.occurredOn);
    const dateLabel = formatDay(day);
    groups[column].push({
      id: row.id,
      fileName: row.fileName,
      merchant,
      amountLabel: moneyLabel(amountCents),
      amountCents: amountCents === null ? null : Math.abs(amountCents),
      dateLabel,
      day,
      duplicate,
      conflict,
      movement: transaction
        ? { id: transaction.id, label: `${transaction.merchant} · ${formatDay(dayKey(transaction.postedOn))}` }
        : null,
      suggestionLabel: !transaction && row.candidates.length
        ? row.candidates.length === 1
          ? "1 sugerencia"
          : `${row.candidates.length} sugerencias`
        : null,
    });
  }
  return groups;
}

export async function reviewBoard(db: Db, actor: Actor) {
  if (!actor.firmRole) {
    throw new AppError("Esta pantalla es del despacho.", 403, "FIRM_FORBIDDEN");
  }
  const companyIds = actor.memberships.map((membership) => membership.companyId);
  const companies = await db.company.findMany({ where: { id: { in: companyIds } } });
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const rows = await db.bankTransaction.findMany({
    where: { companyId: { in: companyIds } },
    include: {
      links: { where: { status: "confirmed" }, include: { document: true } },
    },
    orderBy: [{ postedOn: "desc" }, { merchant: "asc" }],
  });
  const groups: Record<ReviewColumn, {
    id: string;
    companyName: string;
    merchant: string;
    amountLabel: string;
    dateLabel: string;
    documentId: string | null;
    documentName: string | null;
    duplicate: boolean;
    conflict: boolean;
    canSeal: boolean;
  }[]> = { revisar: [], cliente: [], aprobar: [], sellado: [] };
  const reviewer = actor.firmRole === "ACCOUNTANT" || actor.firmRole === "FIRM_ADMIN";
  for (const row of rows) {
    const column = reviewColumn({
      sealed: Boolean(row.sealedAt),
      reviewState: row.reviewState,
      documentState: row.documentState,
    });
    const document = row.links[0]?.document ?? null;
    groups[column].push({
      id: row.id,
      companyName: companyName.get(row.companyId) ?? "",
      merchant: row.merchant,
      amountLabel: moneyLabel(row.amountCents),
      dateLabel: formatDay(dayKey(row.postedOn)),
      documentId: document?.id ?? null,
      documentName: document?.fileName ?? null,
      duplicate: document?.status === "duplicate" || Boolean(document?.duplicateOfId),
      conflict: row.documentState === "Conflict" || document?.status === "conflict",
      canSeal: reviewer && column === "aprobar",
    });
  }
  return groups;
}

export async function getBoardReceipt(
  db: Db,
  actor: Actor,
  input: { documentId?: string | null; transactionId?: string | null },
) {
  const transactionInclude = {
    links: { where: { status: "confirmed" }, include: { document: { include: { extraction: true, duplicateOf: true, candidates: true } } } },
    company: true,
    audits: { where: { action: "document_replaced" }, orderBy: { createdAt: "desc" as const }, take: 1 },
  };
  let transaction = input.transactionId
    ? await db.bankTransaction.findUnique({ where: { id: input.transactionId }, include: transactionInclude })
    : null;
  let document = transaction?.links[0]?.document ?? null;
  if (input.documentId && (!document || document.id !== input.documentId)) {
    const loaded = await db.document.findUnique({
      where: { id: input.documentId },
      include: {
        extraction: true,
        duplicateOf: true,
        candidates: true,
        links: { where: { status: "confirmed" }, include: { transaction: { include: transactionInclude } } },
      },
    });
    if (!loaded) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
    document = loaded;
    transaction = loaded.links[0]?.transaction ?? transaction;
  }
  if (!document && !transaction) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
  if (transaction && document && transaction.companyId !== document.companyId) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  if (transaction && !companyRole(actor, transaction.companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const companyId = transaction?.companyId ?? document?.companyId ?? "";
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const candidates = document && !transaction
    ? await Promise.all(document.candidates.filter((candidate) => !candidate.blocked && candidate.decision !== "conflict").map(async (candidate) => {
        const match = await db.bankTransaction.findUnique({ where: { id: candidate.transactionId } });
        if (!match || match.sealedAt || match.companyId !== companyId) return null;
        return {
          transactionId: match.id,
          merchant: match.merchant,
          amountLabel: moneyLabel(match.amountCents),
          dateLabel: formatDay(dayKey(match.postedOn)),
        };
      }))
    : [];
  const choices = transaction
    ? (await db.document.findMany({
        where: { companyId },
        include: {
          extraction: true,
          links: { where: { status: "confirmed" }, select: { transactionId: true } },
        },
        orderBy: { fileName: "asc" },
      })).filter((item) => item.id !== document?.id && !item.links.some((link) => link.transactionId !== transaction?.id))
        .map((item) => ({
          id: item.id,
          fileName: item.fileName,
          merchant: item.extraction?.merchant ?? null,
          amountCents: item.extraction?.amountCents ?? null,
        }))
    : [];
  const audit = transaction && "audits" in transaction ? transaction.audits[0] : null;
  const merchant = transaction?.merchant || document?.extraction?.merchant || document?.fileName || "Sin datos";
  const amountCents = transaction?.amountCents ?? document?.extraction?.amountCents ?? null;
  const dateLabel = formatDay(dayKey(transaction?.postedOn) ?? dayKey(document?.extraction?.occurredOn));
  return {
    document: document
      ? {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          merchant,
          amountLabel: moneyLabel(amountCents),
          dateLabel,
        }
      : null,
    movement: transaction
      ? {
          id: transaction.id,
          merchant: transaction.merchant,
          amountCents: transaction.amountCents,
          amountLabel: moneyLabel(transaction.amountCents),
          dateLabel: formatDay(dayKey(transaction.postedOn)),
          sealed: Boolean(transaction.sealedAt),
        }
      : null,
    candidates: candidates.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
    choices,
    duplicate: document?.status === "duplicate" || Boolean(document?.duplicateOfId),
    duplicateOfName: document?.duplicateOf?.fileName ?? null,
    conflict: document?.status === "conflict" || document?.candidates.some((candidate) => candidate.decision === "conflict") || transaction?.documentState === "Conflict",
    canReview: canReview(actor, companyId),
    auditNote: audit ? documentChangeNote(audit.action, audit.previousJson, audit.nextJson) : null,
  };
}

export async function readDocumentFile(db: Db, actor: Actor, documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
  if (!companyRole(actor, document.companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  return document;
}

import { dayKey, formatDateTime, formatDay } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { AUDIT_LABEL } from "@/lib/labels";
import { canReview, companyRole, type Actor, type MembershipRole } from "@/lib/permissions";
import { localProviders } from "@/providers/local";
import type { Db } from "@/server/db";

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
  if (filter === "por-revisar") return { reviewState: "NeedsReview" };
  if (filter === "aprobados") return { reviewState: "Approved" };
  return {};
}

export async function listMovements(db: Db, actor: Actor, companyId: string, filter: string, q: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.bankTransaction.findMany({
    where: { companyId, ...movementWhere(filter) },
    include: {
      classification: { include: { category: true, subcategory: true } },
      account: true,
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
      documentState: row.documentState,
      reviewState: row.reviewState,
      reconciliationState: row.reconciliationState,
      sealed: Boolean(row.sealedAt),
      institution: row.account.institution,
      mask: row.account.mask,
    }));
}

export async function movementCounts(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.bankTransaction.findMany({
    where: { companyId },
    select: { accountingState: true, documentState: true, reviewState: true },
  });
  return {
    todos: rows.length,
    sinCategoria: rows.filter((row) => row.accountingState === "Uncategorized").length,
    sinComprobante: rows.filter((row) => row.documentState === "Missing").length,
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
    bankState: transaction.bankState,
    sealed: Boolean(transaction.sealedAt),
    sealedAt: transaction.sealedAt ? formatDateTime(transaction.sealedAt) : null,
    subcategoryId: transaction.classification?.subcategoryId ?? "",
    categoryLabel: transaction.classification?.category && transaction.classification.subcategory
      ? `${transaction.classification.category.name} / ${transaction.classification.subcategory.name}`
      : "Sin categoría",
    pairs,
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
      previousJson: event.previousJson,
      nextJson: event.nextJson,
    })),
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

export async function listDocuments(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const rows = await db.document.findMany({
    where: { companyId },
    include: { extraction: true, links: true },
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
  }));
}

export async function listCategoryTree(db: Db, actor: Actor, companyId: string) {
  if (!companyRole(actor, companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  const categories = await localProviders(db).accounting.listCategories(companyId);
  return categories
    .filter((category) => !category.parentId)
    .map((parent) => ({
      ...parent,
      children: categories.filter((category) => category.parentId === parent.id),
    }));
}

export async function readDocumentFile(db: Db, actor: Actor, documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) throw new AppError("No existe ese comprobante.", 404, "NOT_FOUND");
  if (!companyRole(actor, document.companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  return document;
}

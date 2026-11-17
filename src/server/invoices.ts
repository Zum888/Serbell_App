import { agingKey, todayKey, type AgingKey } from "@/lib/aging";
import { type Approval, nextApproval, normalizeApproval } from "@/lib/approval";
import { dayKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { evaluateMatch } from "@/lib/matching";
import { formatUsd } from "@/lib/money";
import { assertCompanyAccess, type Actor } from "@/lib/permissions";
import type { Db } from "@/server/db";
import { nid } from "@/server/ids";

export type InvoiceDirection = "receivable" | "payable";

export type AgingTotals = Record<AgingKey, number>;

export type InvoiceFolder = {
  partyId: string;
  name: string;
  invoiceCount: number;
  totalCents: number;
  openCents: number;
  matchedCount: number;
  aging: AgingTotals;
};

export type InvoiceCard = {
  id: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  amountCents: number;
  status: string;
  approval: Approval;
  followUpAt: string | null;
  aging: AgingKey | null;
  movement: { id: string; merchant: string; postedOn: string; amountCents: number } | null;
};

export type DeskSummary = {
  totalCents: number;
  openCents: number;
  matchedCents: number;
  invoiceCount: number;
  counts: Record<Approval, number>;
};

const emptyAging = (): AgingTotals => ({ current: 0, d30: 0, d60: 0, d60plus: 0 });

async function audit(
  db: Db,
  input: {
    companyId: string;
    actorId: string;
    transactionId?: string | null;
    action: string;
    previous?: unknown;
    next?: unknown;
  },
) {
  await db.auditEvent.create({
    data: {
      id: nid("aud"),
      companyId: input.companyId,
      actorId: input.actorId,
      transactionId: input.transactionId ?? null,
      action: input.action,
      previousJson: input.previous === undefined ? null : JSON.stringify(input.previous),
      nextJson: input.next === undefined ? null : JSON.stringify(input.next),
    },
  });
}

async function loadInvoice(db: Db, invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { party: true, links: { where: { status: "confirmed" } } },
  });
  if (!invoice) throw new AppError("No existe esa factura.", 404, "NOT_FOUND");
  return invoice;
}

export async function matchInvoice(db: Db, invoiceId: string) {
  const invoice = await loadInvoice(db, invoiceId);
  const sign = invoice.direction === "receivable" ? 1 : -1;
  const taken = await db.invoiceLink.findMany({
    where: { status: "confirmed", invoice: { companyId: invoice.companyId } },
    select: { invoiceId: true, transactionId: true },
  });
  const takenByTransaction = new Map(taken.map((link) => [link.transactionId, link.invoiceId]));
  const transactions = await db.bankTransaction.findMany({
    where: { companyId: invoice.companyId },
  });
  return evaluateMatch({
    document: {
      id: invoice.id,
      merchant: invoice.party.name,
      amountCents: invoice.amountCents,
      currency: invoice.currency,
      occurredOn: dayKey(invoice.dueOn),
      fileHash: null,
    },
    transactions: transactions
      .filter((transaction) => Math.sign(transaction.amountCents) === sign)
      .map((transaction) => ({
        id: transaction.id,
        merchant: transaction.merchant,
        amountCents: transaction.amountCents,
        currency: transaction.currency,
        postedOn: dayKey(transaction.postedOn) ?? "",
        confirmedDocumentId: takenByTransaction.get(transaction.id) ?? null,
      })),
    documents: [],
  });
}

export async function linkInvoice(db: Db, actor: Actor, invoiceId: string, transactionId: string) {
  const invoice = await loadInvoice(db, invoiceId);
  assertCompanyAccess(actor, invoice.companyId);
  if (invoice.links.some((link) => link.transactionId === transactionId)) return;
  if (invoice.links.length) {
    throw new AppError("La factura ya está vinculada a un movimiento.", 409, "CONFLICT");
  }
  const transaction = await db.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new AppError("No existe ese movimiento.", 404, "NOT_FOUND");
  if (transaction.companyId !== invoice.companyId) {
    throw new AppError("La factura y el movimiento son de empresas distintas.", 403, "COMPANY_FORBIDDEN");
  }
  if (transaction.sealedAt) {
    throw new AppError("El servidor rechazó la edición: el movimiento está sellado.", 403, "SEALED");
  }
  const result = await matchInvoice(db, invoiceId);
  if (result.decision === "none" || result.decision === "conflict" || result.decision === "duplicate") {
    throw new AppError(result.reasonsAgainst.join(" ") || "No hay un movimiento compatible.", 409, result.decision.toUpperCase());
  }
  const candidate = result.candidates.find((item) => item.transactionId === transactionId && !item.blocked);
  if (!candidate) throw new AppError("Ese movimiento no es un candidato compatible.", 400, "NOT_A_CANDIDATE");
  if (result.decision === "reliable" && result.proposedTransactionId !== transactionId) {
    throw new AppError("La coincidencia única es otro movimiento.", 400, "NOT_THE_MATCH");
  }
  await db.invoiceLink.create({
    data: {
      id: nid("ilink"),
      invoiceId,
      transactionId,
      status: "confirmed",
      confirmedById: actor.id,
      confirmedAt: new Date(),
    },
  });
  await db.invoice.update({ where: { id: invoiceId }, data: { status: "matched" } });
  await audit(db, {
    companyId: invoice.companyId,
    actorId: actor.id,
    transactionId,
    action: "invoice_linked",
    previous: { status: invoice.status, transactionId: null },
    next: { status: "matched", transactionId, number: invoice.number },
  });
}

export async function markInvoiceFollowUp(db: Db, actor: Actor, invoiceId: string) {
  const invoice = await loadInvoice(db, invoiceId);
  assertCompanyAccess(actor, invoice.companyId);
  if (invoice.followUpAt) return;
  const followUpAt = new Date();
  await db.invoice.update({ where: { id: invoiceId }, data: { followUpAt } });
  await audit(db, {
    companyId: invoice.companyId,
    actorId: actor.id,
    transactionId: invoice.links[0]?.transactionId ?? null,
    action: "invoice_follow_up",
    previous: { followUpAt: null, status: invoice.status, amountCents: invoice.amountCents },
    next: { followUpAt: followUpAt.toISOString(), status: invoice.status, amountCents: invoice.amountCents },
  });
}

export async function invoiceDesk(
  db: Db,
  actor: Actor,
  companyId: string,
  direction: InvoiceDirection,
  today = todayKey(),
) {
  assertCompanyAccess(actor, companyId);
  const rows = await db.invoice.findMany({
    where: { companyId, direction },
    include: {
      party: true,
      links: { where: { status: "confirmed" }, include: { transaction: true } },
    },
    orderBy: [{ party: { name: "asc" } }, { dueOn: "asc" }],
  });
  const byParty = new Map<string, InvoiceFolder & { invoices: InvoiceCard[] }>();
  const summary: DeskSummary = {
    totalCents: 0,
    openCents: 0,
    matchedCents: 0,
    invoiceCount: 0,
    counts: { por_autorizar: 0, autorizada: 0, en_proceso: 0, conciliada: 0 },
  };
  for (const row of rows) {
    const folder = byParty.get(row.partyId) ?? {
      partyId: row.partyId,
      name: row.party.name,
      invoiceCount: 0,
      totalCents: 0,
      openCents: 0,
      matchedCount: 0,
      aging: emptyAging(),
      invoices: [],
    };
    const link = row.links[0] ?? null;
    const matched = row.status === "matched" && Boolean(link);
    const approval: Approval = matched ? "conciliada" : normalizeApproval(row.approval);
    const due = dayKey(row.dueOn) ?? "";
    const bucket = matched ? null : agingKey(due, today);
    folder.invoiceCount += 1;
    folder.totalCents += row.amountCents;
    if (matched) folder.matchedCount += 1;
    else {
      folder.openCents += row.amountCents;
      if (bucket) folder.aging[bucket] += row.amountCents;
    }
    summary.invoiceCount += 1;
    summary.totalCents += row.amountCents;
    if (matched) summary.matchedCents += row.amountCents;
    else summary.openCents += row.amountCents;
    summary.counts[approval] += 1;
    folder.invoices.push({
      id: row.id,
      number: row.number,
      issuedOn: dayKey(row.issuedOn) ?? "",
      dueOn: due,
      amountCents: row.amountCents,
      status: matched ? "matched" : "open",
      approval,
      followUpAt: row.followUpAt?.toISOString() ?? null,
      aging: bucket,
      movement: link
        ? {
            id: link.transaction.id,
            merchant: link.transaction.merchant,
            postedOn: dayKey(link.transaction.postedOn) ?? "",
            amountCents: link.transaction.amountCents,
          }
        : null,
    });
    byParty.set(row.partyId, folder);
  }
  const folders = [...byParty.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { folders, summary };
}

export async function advanceInvoiceApproval(db: Db, actor: Actor, invoiceId: string) {
  const invoice = await loadInvoice(db, invoiceId);
  assertCompanyAccess(actor, invoice.companyId);
  if (invoice.status === "matched") {
    throw new AppError("La factura ya está conciliada con el banco.", 409, "ALREADY_MATCHED");
  }
  const current = normalizeApproval(invoice.approval);
  const target = nextApproval(current);
  if (!target) throw new AppError("La factura ya avanzó todo lo que se puede a mano.", 409, "NO_NEXT_STEP");
  await db.invoice.update({ where: { id: invoiceId }, data: { approval: target } });
  await audit(db, {
    companyId: invoice.companyId,
    actorId: actor.id,
    transactionId: invoice.links[0]?.transactionId ?? null,
    action: "invoice_approval",
    previous: { approval: current, number: invoice.number },
    next: { approval: target, number: invoice.number },
  });
  return target;
}

export async function invoicePanel(db: Db, actor: Actor, invoiceId: string) {
  const invoice = await loadInvoice(db, invoiceId);
  assertCompanyAccess(actor, invoice.companyId);
  const link = invoice.links[0] ?? null;
  const movement = link
    ? await db.bankTransaction.findUnique({ where: { id: link.transactionId } })
    : null;
  const result = link ? null : await matchInvoice(db, invoiceId);
  const linkable =
    result && (result.decision === "reliable" || result.decision === "ambiguous")
      ? result.candidates.filter((candidate) => !candidate.blocked && (result.decision === "ambiguous" || candidate.transactionId === result.proposedTransactionId))
      : [];
  const transactions = linkable.length
    ? await db.bankTransaction.findMany({ where: { id: { in: linkable.map((item) => item.transactionId) } } })
    : [];
  return {
    id: invoice.id,
    companyId: invoice.companyId,
    partyId: invoice.partyId,
    partyName: invoice.party.name,
    number: invoice.number,
    direction: invoice.direction,
    issuedOn: dayKey(invoice.issuedOn) ?? "",
    dueOn: dayKey(invoice.dueOn) ?? "",
    amountCents: invoice.amountCents,
    amountLabel: formatUsd(invoice.amountCents),
    status: invoice.status,
    approval: (invoice.status === "matched" ? "conciliada" : normalizeApproval(invoice.approval)) as Approval,
    isDemonstration: invoice.isDemonstration,
    followUpAt: invoice.followUpAt?.toISOString() ?? null,
    aging: invoice.status === "matched" ? null : agingKey(dayKey(invoice.dueOn) ?? "", todayKey()),
    movement: movement
      ? {
          id: movement.id,
          merchant: movement.merchant,
          postedOn: dayKey(movement.postedOn) ?? "",
          amountLabel: formatUsd(movement.amountCents),
          sealed: Boolean(movement.sealedAt),
        }
      : null,
    matchNote: result?.reasonsAgainst[0] ?? result?.reasonsFor[0] ?? null,
    candidates: transactions.map((transaction) => ({
      transactionId: transaction.id,
      merchant: transaction.merchant,
      postedOn: dayKey(transaction.postedOn) ?? "",
      amountLabel: formatUsd(transaction.amountCents),
      sealed: Boolean(transaction.sealedAt),
    })),
  };
}

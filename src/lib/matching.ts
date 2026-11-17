import { formatDay } from "@/lib/dates";
import { formatUsd } from "@/lib/money";

export type MatchDecision = "reliable" | "ambiguous" | "none" | "conflict" | "duplicate";

export type MatchTxn = {
  id: string;
  merchant: string;
  amountCents: number;
  currency: string;
  postedOn: string;
  confirmedDocumentId: string | null;
};

export type MatchDoc = {
  id: string;
  merchant: string;
  amountCents: number;
  currency: string;
  occurredOn: string | null;
  fileHash: string | null;
};

export type OtherDoc = {
  id: string;
  merchant: string | null;
  amountCents: number | null;
  occurredOn: string | null;
  fileHash: string | null;
};

export type MatchCandidateView = {
  transactionId: string;
  evidence: {
    amountCents: number;
    currency: string;
    postedOn: string;
    merchant: string;
    documentAmountCents: number;
    documentMerchant: string;
    documentDate: string | null;
  };
  reasonsFor: string[];
  reasonsAgainst: string[];
  blocked: boolean;
};

export type MatchResult = {
  decision: MatchDecision;
  candidates: MatchCandidateView[];
  reasonsFor: string[];
  reasonsAgainst: string[];
  duplicateOfDocumentId: string | null;
  proposedTransactionId: string | null;
};

export function normalizeMerchant(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameMerchant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizeMerchant(a);
  const right = normalizeMerchant(b);
  return left.length > 0 && left === right;
}

export function evaluateMatch(input: {
  document: MatchDoc;
  transactions: MatchTxn[];
  documents: OtherDoc[];
}): MatchResult {
  const documentAmount = Math.abs(input.document.amountCents);
  const duplicate = input.documents.find((other) => {
    if (other.id === input.document.id) return false;
    if (input.document.fileHash && other.fileHash && input.document.fileHash === other.fileHash) {
      return true;
    }
    return (
      input.document.occurredOn !== null &&
      other.occurredOn === input.document.occurredOn &&
      other.amountCents !== null &&
      Math.abs(other.amountCents) === documentAmount &&
      sameMerchant(other.merchant, input.document.merchant)
    );
  });

  const aligned = input.transactions.filter(
    (txn) =>
      txn.currency === input.document.currency &&
      Math.abs(txn.amountCents) === documentAmount &&
      sameMerchant(txn.merchant, input.document.merchant),
  );

  const candidates: MatchCandidateView[] = aligned.map((txn) => {
    const reasonsFor: string[] = [
      `El importe coincide exactamente (${formatUsd(documentAmount)}).`,
      `El comercio es el mismo (${txn.merchant}).`,
    ];
    const reasonsAgainst: string[] = [];
    const dateMatches = input.document.occurredOn !== null && txn.postedOn === input.document.occurredOn;
    if (dateMatches && input.document.occurredOn) {
      reasonsFor.push(
        `La fecha del comprobante (${formatDay(input.document.occurredOn)}) coincide con la del movimiento bancario.`,
      );
    } else if (input.document.occurredOn) {
      reasonsAgainst.push(
        `La fecha no coincide: el comprobante es ${formatDay(input.document.occurredOn)} y el movimiento es ${formatDay(txn.postedOn)}.`,
      );
    } else {
      reasonsAgainst.push("El comprobante no tiene fecha. La comparación usa comercio e importe.");
    }
    const blocked = Boolean(txn.confirmedDocumentId && txn.confirmedDocumentId !== input.document.id);
    if (blocked) {
      reasonsAgainst.push(
        "Este movimiento ya tiene un comprobante vinculado incompatible. No se asigna otro automáticamente.",
      );
    }
    return {
      transactionId: txn.id,
      evidence: {
        amountCents: Math.abs(txn.amountCents),
        currency: txn.currency,
        postedOn: txn.postedOn,
        merchant: txn.merchant,
        documentAmountCents: documentAmount,
        documentMerchant: input.document.merchant,
        documentDate: input.document.occurredOn,
      },
      reasonsFor,
      reasonsAgainst,
      blocked,
    };
  });

  if (duplicate) {
    return {
      decision: "duplicate",
      candidates,
      reasonsFor: [],
      reasonsAgainst: [
        "Ya existe un comprobante con el mismo archivo, o con el mismo comercio, importe y fecha.",
      ],
      duplicateOfDocumentId: duplicate.id,
      proposedTransactionId: null,
    };
  }

  const pool = input.document.occurredOn
    ? candidates.filter((candidate) => candidate.evidence.postedOn === input.document.occurredOn)
    : candidates;
  const open = pool.filter((candidate) => !candidate.blocked);
  const blocked = pool.filter((candidate) => candidate.blocked);
  const conflictReason = [
    "El movimiento compatible ya tiene un comprobante vinculado. No se asigna otro automáticamente.",
  ];

  if (open.length === 1) {
    return {
      decision: "reliable",
      candidates,
      reasonsFor: open[0].reasonsFor,
      reasonsAgainst: open[0].reasonsAgainst,
      duplicateOfDocumentId: null,
      proposedTransactionId: open[0].transactionId,
    };
  }
  if (open.length > 1) {
    return {
      decision: "ambiguous",
      candidates,
      reasonsFor: [],
      reasonsAgainst: [
        input.document.occurredOn
          ? "Hay más de un movimiento con el mismo comercio, importe y fecha. Hay que elegir uno."
          : "Hay más de un movimiento con el mismo comercio e importe. Hay que elegir uno.",
      ],
      duplicateOfDocumentId: null,
      proposedTransactionId: null,
    };
  }
  if (blocked.length > 0) {
    return {
      decision: "conflict",
      candidates,
      reasonsFor: blocked[0]?.reasonsFor ?? [],
      reasonsAgainst: conflictReason,
      duplicateOfDocumentId: null,
      proposedTransactionId: null,
    };
  }
  return {
    decision: "none",
    candidates,
    reasonsFor: [],
    reasonsAgainst: [
      candidates.length && input.document.occurredOn
        ? "Hay movimientos del mismo comercio e importe, pero ninguno en la fecha del comprobante."
        : "No hay un movimiento con el mismo importe y comercio.",
    ],
    duplicateOfDocumentId: null,
    proposedTransactionId: null,
  };
}

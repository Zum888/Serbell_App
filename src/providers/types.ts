import type { ExtractionDraft } from "@/lib/extraction";
import type { MatchResult, MatchDoc, MatchTxn, OtherDoc } from "@/lib/matching";

export type BankAccountRecord = {
  id: string;
  companyId: string;
  institution: string;
  productName: string;
  mask: string;
  name: string;
  currency: string;
  availableBalanceCents: number;
};

export type CategoryRecord = {
  id: string;
  parentId: string | null;
  name: string;
};

export interface BankDataProvider {
  listAccounts(companyId: string): Promise<BankAccountRecord[]>;
}

export interface DocumentExtractionProvider {
  extract(fileName: string): ExtractionDraft;
}

export interface TransactionMatchingService {
  evaluate(input: { document: MatchDoc; transactions: MatchTxn[]; documents: OtherDoc[] }): MatchResult;
}

export interface AccountingProvider {
  listCategories(companyId: string): Promise<CategoryRecord[]>;
}

export interface MessagingProvider {
  append(input: {
    conversationId: string;
    authorId: string | null;
    transactionId?: string | null;
    documentId?: string | null;
    role: "user" | "assistant";
    body: string;
    intent?: string | null;
  }): Promise<void>;
}

export interface RuleLearningService {
  record(input: {
    companyId: string;
    actorId: string;
    transactionId: string;
    beforeJson: string;
    afterJson: string;
    justification: string | null;
  }): Promise<void>;
}

export type LabProviders = {
  bank: BankDataProvider;
  extraction: DocumentExtractionProvider;
  matching: TransactionMatchingService;
  accounting: AccountingProvider;
  messaging: MessagingProvider;
  rules: RuleLearningService;
};

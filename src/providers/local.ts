import { extractLocal } from "@/lib/extraction";
import { evaluateMatch } from "@/lib/matching";
import type { Db } from "@/server/db";
import { nid } from "@/server/ids";
import type { LabProviders } from "@/providers/types";

export function localProviders(db: Db): LabProviders {
  return {
    bank: {
      async listAccounts(companyId) {
        const rows = await db.bankAccount.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
        });
        return rows.map((row) => ({
          id: row.id,
          companyId: row.companyId,
          institution: row.institution,
          productName: row.productName,
          mask: row.mask,
          name: row.name,
          currency: row.currency,
          availableBalanceCents: row.availableBalanceCents,
        }));
      },
    },
    extraction: {
      extract: extractLocal,
    },
    matching: {
      evaluate: evaluateMatch,
    },
    accounting: {
      async listCategories(companyId) {
        const rows = await db.accountingCategory.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
        });
        return rows.map((row) => ({ id: row.id, parentId: row.parentId, name: row.name }));
      },
    },
    messaging: {
      async append(input) {
        await db.message.create({
          data: {
            id: nid("msg"),
            conversationId: input.conversationId,
            authorId: input.authorId,
            transactionId: input.transactionId ?? null,
            documentId: input.documentId ?? null,
            role: input.role,
            body: input.body,
            intent: input.intent ?? null,
          },
        });
      },
    },
    rules: {
      async record(input) {
        await db.classificationRule.create({
          data: {
            id: nid("rule"),
            companyId: input.companyId,
            actorId: input.actorId,
            transactionId: input.transactionId,
            beforeJson: input.beforeJson,
            afterJson: input.afterJson,
            justification: input.justification,
            applied: false,
          },
        });
      },
    },
  };
}

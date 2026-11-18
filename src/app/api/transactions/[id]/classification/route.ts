import { NextResponse } from "next/server";
import { ACCOUNTING_LABEL, REVIEW_LABEL } from "@/lib/labels";
import { isAppError } from "@/lib/errors";
import { safeNext } from "@/lib/utils";
import { db } from "@/server/db";
import { changeClassification } from "@/server/domain";
import { redirectError, redirectTo, wantsJson } from "@/server/http";
import { requireActor } from "@/server/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData();
  const back = safeNext(String(form.get("next") ?? ""), `/movimientos?movimiento=${id}`);
  const json = wantsJson(request);
  try {
    const { actor } = await requireActor();
    await changeClassification((await db()), actor, id, {
      subcategoryId: String(form.get("subcategoryId") ?? ""),
      justification: String(form.get("justification") ?? ""),
    });
    if (json) {
      const row = await (await db()).bankTransaction.findUnique({
        where: { id },
        include: { classification: { include: { category: true, subcategory: true } } },
      });
      const label = row?.classification?.category && row.classification.subcategory
        ? `${row.classification.category.name} / ${row.classification.subcategory.name}`
        : "Sin categoría";
      return NextResponse.json({
        categoryLabel: label,
        reviewState: row?.reviewState ?? "",
        reviewLabel: REVIEW_LABEL[row?.reviewState ?? ""] ?? row?.reviewState ?? "",
        accountingLabel: ACCOUNTING_LABEL[row?.accountingState ?? ""] ?? row?.accountingState ?? "",
      });
    }
    return redirectTo(request, back);
  } catch (error) {
    if (json && isAppError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return redirectError(request, back, error);
  }
}

import { NextResponse } from "next/server";
import { COMPANY } from "@/lib/ids";
import { assertCompanyAccess } from "@/lib/permissions";
import { db } from "@/server/db";
import { redirectError, redirectTo } from "@/server/http";
import { requireActor } from "@/server/session";

const DEMO_TICKET = "doc_demo_fs_20394";

export function GET() {
  return NextResponse.json(
    { error: "Usa el botón para abrir el comprobante de demostración.", code: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: { allow: "POST" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const companyId = String(form.get("companyId") ?? "");
  try {
    const { actor } = await requireActor();
    assertCompanyAccess(actor, companyId);
    const database = await db();
    if (companyId === COMPANY.qpl) {
      await database.document.upsert({
        where: { id: DEMO_TICKET },
        update: {},
        create: {
          id: DEMO_TICKET,
          companyId,
          uploadedById: actor.id,
          fileName: "FleetSmarts_ticket.jpg",
          mimeType: "image/svg+xml",
          sizeBytes: 0,
          storagePath: "",
          status: "pending",
        },
      });
      await database.documentExtraction.upsert({
        where: { documentId: DEMO_TICKET },
        update: {},
        create: {
          id: "ext_demo_fs_20394",
          documentId: DEMO_TICKET,
          merchant: "FleetSmarts",
          amountCents: 20394,
          currency: "USD",
          occurredOn: new Date("2026-10-12T12:00:00.000Z"),
          source: "demonstration",
          isDemonstration: true,
          notice: "Dato de demostración. No es una lectura de un archivo.",
        },
      });
      return redirectTo(request, `/chat?documento=${DEMO_TICKET}`);
    }
    const sample = await database.document.findFirst({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    if (!sample) {
      return redirectTo(request, "/chat", "Esta empresa no tiene comprobantes de demostración.");
    }
    return redirectTo(request, `/chat?documento=${sample.id}`);
  } catch (error) {
    return redirectError(request, "/chat", error);
  }
}

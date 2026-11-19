import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { visitorDatabaseFile } from "@/server/ensure-db";

const root = mkdtempSync(path.join(tmpdir(), "serbell-visitors-"));
const previousRoot = process.env.SERBELL_DATA_ROOT;

beforeAll(() => {
  process.env.SERBELL_DATA_ROOT = root;
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env.SERBELL_DATA_ROOT;
  else process.env.SERBELL_DATA_ROOT = previousRoot;
  rmSync(root, { recursive: true, force: true });
});

it("dos visitantes no comparten la base", async () => {
  const leftKey = randomBytes(16).toString("hex");
  const rightKey = randomBytes(16).toString("hex");
  expect(leftKey).toBeTruthy();
  expect(rightKey).toBeTruthy();
  const leftPath = await visitorDatabaseFile(leftKey!);
  const rightPath = await visitorDatabaseFile(rightKey!);
  expect(leftPath).not.toBe(rightPath);
  const left = new PrismaClient({ datasources: { db: { url: `file:${leftPath}` } } });
  const right = new PrismaClient({ datasources: { db: { url: `file:${rightPath}` } } });
  try {
    await left.document.create({
      data: {
        id: "doc_isolation_probe",
        companyId: "co_qpl",
        uploadedById: "usr_padrino",
        fileName: "privado.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 4,
        storagePath: "demo/doc_isolation_probe",
        status: "received",
      },
    });
    expect(await left.document.findUnique({ where: { id: "doc_isolation_probe" } })).not.toBeNull();
    expect(await right.document.findUnique({ where: { id: "doc_isolation_probe" } })).toBeNull();
  } finally {
    await left.$disconnect();
    await right.$disconnect();
  }
}, 60000);

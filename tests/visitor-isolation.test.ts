import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { grantCookie, readSignedVisitor } from "@/server/access";
import { visitorDatabaseFile } from "@/server/ensure-db";

const root = mkdtempSync(path.join(tmpdir(), "serbell-visitors-"));
const previousRoot = process.env.SERBELL_DATA_ROOT;
const previousPassword = process.env.SERBELL_ACCESS_PASSWORD;

beforeAll(() => {
  process.env.SERBELL_DATA_ROOT = root;
  process.env.SERBELL_ACCESS_PASSWORD = "clave-de-prueba";
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env.SERBELL_DATA_ROOT;
  else process.env.SERBELL_DATA_ROOT = previousRoot;
  if (previousPassword === undefined) delete process.env.SERBELL_ACCESS_PASSWORD;
  else process.env.SERBELL_ACCESS_PASSWORD = previousPassword;
  rmSync(root, { recursive: true, force: true });
});

it("la cookie firma un id distinto por navegador y rechaza la llave compartida", () => {
  const first = grantCookie();
  const second = grantCookie();
  expect(first?.value).toBeTruthy();
  expect(second?.value).toBeTruthy();
  const left = readSignedVisitor(first?.value);
  const right = readSignedVisitor(second?.value);
  expect(left).toMatch(/^[a-f0-9]{32}$/);
  expect(right).toMatch(/^[a-f0-9]{32}$/);
  expect(left).not.toBe(right);
  expect(readSignedVisitor("public-demo")).toBeNull();
  expect(readSignedVisitor(`${left}.` + "ab".repeat(32))).toBeNull();
  expect(readSignedVisitor(grantCookie(first?.value)?.value)).toBe(left);
});

it("dos visitantes no comparten movimientos ni comprobantes", async () => {
  const leftKey = readSignedVisitor(grantCookie()?.value);
  const rightKey = readSignedVisitor(grantCookie()?.value);
  expect(leftKey).toBeTruthy();
  expect(rightKey).toBeTruthy();
  const left = new PrismaClient({ datasources: { db: { url: `file:${await visitorDatabaseFile(leftKey!)}` } } });
  const right = new PrismaClient({ datasources: { db: { url: `file:${await visitorDatabaseFile(rightKey!)}` } } });
  try {
    const before = await right.document.count();
    await left.document.create({
      data: {
        id: "doc_isolation_probe",
        companyId: "co_qpl",
        uploadedById: "usr_padrino",
        fileName: "privado.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 4,
        storagePath: "storage/visitors/left/privado.jpg",
        status: "received",
      },
    });
    expect(await left.document.findUnique({ where: { id: "doc_isolation_probe" } })).not.toBeNull();
    expect(await right.document.count()).toBe(before);
    expect(await right.document.findUnique({ where: { id: "doc_isolation_probe" } })).toBeNull();
    expect(await visitorDatabaseFile(leftKey!)).not.toBe(await visitorDatabaseFile(rightKey!));
  } finally {
    await left.$disconnect();
    await right.$disconnect();
  }
}, 60000);

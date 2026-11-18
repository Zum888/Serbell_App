import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { insertExtraDemo, seedDatabase } from "@/server/seed";

const DEFAULT_DATABASE_URL = "file:./dev.db";

/** Relative SQLite URLs are resolved from prisma/schema.prisma, the same way Prisma does. */
export function sqliteFileFromUrl(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  const spec = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  if (spec.length === 0 || spec === ":memory:") return null;
  if (path.isAbsolute(spec)) return spec;
  return path.resolve(process.cwd(), "prisma", spec);
}

/**
 * Idempotent, best-effort column additions for a database that already exists
 * from an earlier deploy. We add columns with raw SQL instead of spawning the
 * Prisma CLI, which is not reliable in the hosted runtime. A column that is
 * already present makes ALTER throw "duplicate column"; that is expected and ignored.
 */
async function ensureColumns(prisma: PrismaClient) {
  const statements = [
    `ALTER TABLE "Invoice" ADD COLUMN "approval" TEXT NOT NULL DEFAULT 'por_autorizar'`,
  ];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // The column already exists; nothing to do.
    }
  }
}

export async function ensureDemoDatabase() {
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  const file = sqliteFileFromUrl(process.env.DATABASE_URL);
  if (!file) return;

  if (existsSync(/*turbopackIgnore: true*/ file)) {
    // The database persisted from a previous deploy. Never spawn Prisma or throw
    // here: a failure must not take down every route. Just add any new columns.
    const prisma = new PrismaClient();
    try {
      await ensureColumns(prisma);
      // A database from an earlier deploy predates the larger demo dataset. Add
      // the new movements and tickets once, best effort, if they are not there.
      const marker = await prisma.bankTransaction.findUnique({ where: { id: "tx_qpl_x01" } }).catch(() => null);
      if (!marker) await insertExtraDemo(prisma).catch(() => undefined);
    } catch {
      // Best effort only; a failure must never take down the app.
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  const schema = path.join(process.cwd(), "prisma", "schema.prisma");
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cli, "db", "push", "--skip-generate", "--schema", schema], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma);
  } catch (error) {
    await prisma.$disconnect();
    rmSync(file, { force: true });
    rmSync(`${file}-journal`, { force: true });
    throw error;
  }
  await prisma.$disconnect();
}

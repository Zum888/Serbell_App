import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { gateEnforced } from "@/server/access";
import { dataRoot } from "@/server/paths";
import { seedDatabase } from "@/server/seed";

const copying = new Map<string, Promise<string>>();
let templateJob: Promise<string> | null = null;

/**
 * The SQLite file for local design work. Production does not use this: each
 * visitor gets a copy under the temp data root.
 */
function localDatabaseFile(): string | null {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith("file:")) return null;
  if (url && url.startsWith("file:")) {
    const spec = decodeURIComponent(url.slice("file:".length).split("?")[0]);
    if (spec && spec !== ":memory:") {
      return path.isAbsolute(spec) ? spec : path.resolve(process.cwd(), "prisma", spec);
    }
  }
  return path.join(process.cwd(), "prisma", "dev.db");
}

function templateFile(): string {
  return path.join(dataRoot(), "template.db");
}

/** Build a seeded database at `file` and close it. The file is the read-only template. */
async function buildAndSeed(file: string) {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${file}`;
  const schema = path.join(process.cwd(), "prisma", "schema.prisma");
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  try {
    execFileSync(process.execPath, [cli, "db", "push", "--skip-generate", "--schema", schema], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    const prisma = new PrismaClient({ datasources: { db: { url: `file:${file}` } } });
    try {
      await seedDatabase(prisma);
      await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (error) {
      await prisma.$disconnect();
      rmSync(file, { force: true });
      rmSync(`${file}-journal`, { force: true });
      rmSync(`${file}-wal`, { force: true });
      rmSync(`${file}-shm`, { force: true });
      throw error;
    }
    await prisma.$disconnect();
    chmodSync(file, 0o644);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

/** One seeded database that is copied per visitor and never opened for requests. */
export function ensureTemplate(): Promise<string> {
  if (!templateJob) {
    templateJob = (async () => {
      const file = templateFile();
      if (!existsSync(/*turbopackIgnore: true*/ file)) {
        mkdirSync(path.dirname(file), { recursive: true });
        await buildAndSeed(file);
      }
      return file;
    })().catch((error) => {
      templateJob = null;
      throw error;
    });
  }
  return templateJob;
}

/**
 * A private copy of the demo for one visitor. `key` is 32 hex characters.
 * Two visitors never share this file.
 */
export function visitorDatabaseFile(key: string): Promise<string> {
  if (!/^[a-f0-9]{32}$/.test(key)) {
    throw new Error("La clave del visitante no es válida.");
  }
  const existing = copying.get(key);
  if (existing) return existing;
  const job = (async () => {
    const file = path.join(dataRoot(), "visitors", `${key}.db`);
    if (!existsSync(/*turbopackIgnore: true*/ file)) {
      const template = await ensureTemplate();
      mkdirSync(path.dirname(file), { recursive: true });
      copyFileSync(template, file);
      chmodSync(file, 0o600);
    }
    return file;
  })().finally(() => {
    copying.delete(key);
  });
  copying.set(key, job);
  return job;
}

/**
 * Prepare storage before the first request. On the published app this only
 * builds the template in a temp directory. It never throws: a failure here
 * must not take down every route.
 */
export async function ensureDemoDatabase() {
  try {
    if (gateEnforced()) {
      await ensureTemplate();
      return;
    }
    const file = localDatabaseFile();
    if (!file || existsSync(/*turbopackIgnore: true*/ file)) return;
    mkdirSync(path.dirname(file), { recursive: true });
    await buildAndSeed(file);
  } catch (error) {
    console.error("ensureDemoDatabase failed:", error);
  }
}

export function localDatabasePath(): string | null {
  return localDatabaseFile();
}

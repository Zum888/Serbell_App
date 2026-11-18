import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "@/server/seed";

/** The pre-seeded demo database that ships with the repository. */
const TEMPLATE_FILE = path.join(process.cwd(), "prisma", "demo.db");

/**
 * Resolve the SQLite file the app should use and make sure DATABASE_URL points
 * at it. Returns null when a managed, non-file datasource (e.g. Postgres) is
 * configured, in which case there is nothing for us to prepare.
 *
 * When no DATABASE_URL is set we default to a writable temp location. The
 * hosted app directory is read-only, so the database must never live there.
 */
function resolveRuntimeFile(): string | null {
  const url = process.env.DATABASE_URL;

  if (url && !url.startsWith("file:")) return null;

  if (url && url.startsWith("file:")) {
    const spec = decodeURIComponent(url.slice("file:".length).split("?")[0]);
    if (spec && spec !== ":memory:") {
      return path.isAbsolute(spec) ? spec : path.resolve(process.cwd(), "prisma", spec);
    }
  }

  const file = path.join(os.tmpdir(), "serbell", "demo.db");
  process.env.DATABASE_URL = `file:${file}`;
  return file;
}

/**
 * Prepare the demo SQLite database. On the hosted runtime this copies the
 * committed, pre-seeded template into a writable location on first boot — no
 * Prisma CLI is spawned and nothing is written to the (read-only) app
 * directory. Only when the template is missing (plain local checkout) do we
 * fall back to building and seeding the schema with the CLI.
 *
 * This function never throws: a failure here must not take down every route.
 */
export async function ensureDemoDatabase() {
  try {
    const file = resolveRuntimeFile();
    if (!file) return;
    if (existsSync(/*turbopackIgnore: true*/ file)) return;

    mkdirSync(path.dirname(file), { recursive: true });

    if (existsSync(/*turbopackIgnore: true*/ TEMPLATE_FILE)) {
      copyFileSync(TEMPLATE_FILE, file);
      // SQLite must be able to write to the copy (and its journal); the source
      // may be read-only when it ships inside a read-only app image.
      chmodSync(file, 0o644);
      return;
    }

    await buildAndSeed(file);
  } catch (error) {
    console.error("ensureDemoDatabase failed:", error);
  }
}

/** Local-dev fallback: build the schema and seed it from scratch. */
async function buildAndSeed(file: string) {
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

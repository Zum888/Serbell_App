import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { dataRoot } from "@/server/paths";
import { seedDatabase } from "@/server/seed";

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

  const file = path.join(dataRoot(), "demo.db");
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
    await buildAndSeed(file);
    chmodSync(file, 0o644);
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

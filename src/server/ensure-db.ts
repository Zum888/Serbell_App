import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "@/server/seed";

const DEFAULT_DATABASE_URL = "file:./dev.db";

/** Relative SQLite URLs are resolved from prisma/schema.prisma, the same way Prisma does. */
export function sqliteFileFromUrl(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  const spec = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  if (spec.length === 0 || spec === ":memory:") return null;
  if (path.isAbsolute(spec)) return spec;
  return path.resolve(process.cwd(), "prisma", spec);
}

export async function ensureDemoDatabase() {
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  const file = sqliteFileFromUrl(process.env.DATABASE_URL);
  if (!file || existsSync(/*turbopackIgnore: true*/ file)) return;

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

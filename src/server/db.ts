import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { gateEnforced } from "@/server/access";
import { localDatabasePath, visitorDatabaseFile } from "@/server/ensure-db";
import { resolveViewer } from "@/server/viewer";

export type Db = PrismaClient;

const pool = new Map<string, PrismaClient>();
const MAX_CLIENTS = 64;

function clientFor(file: string): PrismaClient {
  const existing = pool.get(file);
  if (existing) {
    pool.delete(file);
    pool.set(file, existing);
    return existing;
  }
  const client = new PrismaClient({ datasources: { db: { url: `file:${file}` } } });
  pool.set(file, client);
  while (pool.size > MAX_CLIENTS) {
    const oldest = pool.keys().next().value;
    if (!oldest) break;
    const stale = pool.get(oldest);
    pool.delete(oldest);
    void stale?.$disconnect();
  }
  return client;
}

/**
 * The database for this request. Local design work uses the single dev file.
 * A published app never does: each browser, and each signed-in person, gets
 * the copy named by their own key.
 */
export async function db(): Promise<PrismaClient> {
  if (!gateEnforced()) {
    const file = localDatabasePath();
    if (!file) throw new AppError("Esta base no es un archivo local.", 500, "NO_DATABASE");
    return clientFor(file);
  }
  const viewer = await resolveViewer();
  if (!viewer) {
    throw new AppError("Escribe la contraseña para entrar al laboratorio.", 401, "NO_ACCESS");
  }
  return clientFor(await visitorDatabaseFile(viewer.databaseKey));
}

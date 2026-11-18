import { accessSync, constants } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Where the app may write. The published bundle's directory is read-only, so
 * production uses a temp directory. Nothing under prisma/ is part of this root,
 * so the demo database is never a file the host can serve.
 */
export function dataRoot(): string {
  try {
    accessSync(process.cwd(), constants.W_OK);
    return process.cwd();
  } catch {
    return path.join(os.tmpdir(), "serbell");
  }
}

export function storageFile(storagePath: string): string {
  return path.join(dataRoot(), storagePath);
}

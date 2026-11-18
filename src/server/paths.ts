import { accessSync, constants } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Where the app may write. In production this is always a temp directory, even
 * when the app folder happens to be writable, so a database or an uploaded
 * receipt is never a file the host can serve. Local design work keeps using
 * the project directory.
 */
export function dataRoot(): string {
  if (process.env.SERBELL_DATA_ROOT) return process.env.SERBELL_DATA_ROOT;
  if (process.env.NODE_ENV === "production") return path.join(os.tmpdir(), "serbell");
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

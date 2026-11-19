/**
 * Published visits each get their own demo database. Local design work uses
 * the single dev file. There is no shared password: the lab is fictional data
 * for reviewing the interface.
 */
export function gateEnforced(): boolean {
  return process.env.NODE_ENV === "production";
}

/** The lab is open. A password is not required. */
export async function hasAccess(): Promise<boolean> {
  return true;
}

import type { VerifiedIdentity } from "../../cursor/identity";

/** Cursor user id of the person who owns this lab. Not a password or token. */
const APP_OWNER_USER_ID = 358083753;

export function isDemoOwner(identity: VerifiedIdentity): boolean {
  if (identity.simulated) return true;
  if (identity.kind !== "person") return false;
  return identity.userId === APP_OWNER_USER_ID;
}

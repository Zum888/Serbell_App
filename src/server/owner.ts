import type { VerifiedIdentity } from "../../cursor/identity";

/**
 * Who may use the lab. The app verifies a Cursor-signed identity (see
 * cursor/identity.ts), which cannot be forged, and when the app is published
 * Private or Team the Cursor platform only ever issues that identity to the
 * owner and the people they invite. So any verified signed-in person who
 * reaches the app is authorised; we do not pin a single numeric user id, which
 * would lock the real owner out if it were wrong. API keys (kind "key") are
 * not interactive viewers and are refused. The local simulated viewer is
 * allowed so the app is usable during development.
 */
export function isDemoOwner(identity: VerifiedIdentity): boolean {
  if (identity.simulated) return true;
  return identity.kind === "person";
}

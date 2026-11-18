import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { readSignedVisitor } from "@/server/access";
import { isDemoOwner } from "@/server/owner";

/** Anonymous browsers are keyed by the random id in the access cookie, never by a shared name. */
export function anonymousViewerSub(visitorId: string): string {
  return `v_${visitorId}`;
}

export function isAnonymousViewer(viewerSub: string): boolean {
  return /^v_[a-f0-9]{32}$/.test(viewerSub);
}

/** Stable file name for a Cursor-signed person. The raw subject is not used as a path. */
export function databaseKeyForIdentity(sub: string): string {
  return createHash("sha256").update(`serbell-identity:${sub}`).digest("hex").slice(0, 32);
}

/**
 * Who this request is, and which database file belongs to them.
 * A signed-in Cursor person wins over the anonymous cookie.
 * Returns null when a public visitor has not passed the password gate.
 */
export async function resolveViewer(): Promise<{ sub: string; databaseKey: string } | null> {
  const identity = await getIdentity(await headers());
  if (identity.verified && isDemoOwner(identity)) {
    return { sub: identity.sub, databaseKey: databaseKeyForIdentity(identity.sub) };
  }
  const cookie = (await cookies()).get("sb_access")?.value;
  const visitorId = readSignedVisitor(cookie);
  if (!visitorId) return null;
  return { sub: anonymousViewerSub(visitorId), databaseKey: visitorId };
}

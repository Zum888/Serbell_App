import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { VISITOR_COOKIE, VISITOR_HEADER, VISITOR_ID } from "@/lib/visitor";
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

function visitorIdFrom(value: string | null | undefined): string | null {
  const id = value?.trim().toLowerCase() ?? "";
  return VISITOR_ID.test(id) ? id : null;
}

/**
 * Who this request is, and which database file belongs to them.
 * A signed-in Cursor person wins over the anonymous cookie.
 * Each browser gets a random id. There is no shared password.
 */
export async function resolveViewer(): Promise<{ sub: string; databaseKey: string } | null> {
  const requestHeaders = await headers();
  const identity = await getIdentity(requestHeaders);
  if (identity.verified && isDemoOwner(identity)) {
    return { sub: identity.sub, databaseKey: databaseKeyForIdentity(identity.sub) };
  }
  const fromCookie = visitorIdFrom((await cookies()).get(VISITOR_COOKIE)?.value);
  const fromRequest = visitorIdFrom(requestHeaders.get(VISITOR_HEADER));
  const visitorId = fromCookie ?? fromRequest;
  if (!visitorId) return null;
  return { sub: anonymousViewerSub(visitorId), databaseKey: visitorId };
}

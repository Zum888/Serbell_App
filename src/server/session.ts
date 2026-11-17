import { cookies, headers } from "next/headers";
import { unauthorized } from "next/navigation";
import { requireIdentity } from "../../cursor/identity";
import { PROFILE_COMPANY, PROFILES } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { db } from "@/server/db";
import { loadActor } from "@/server/queries";

export const USER_COOKIE = "serbell_user";
export const COMPANY_COOKIE = "serbell_company";

export const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
};

export function profileById(userId: string) {
  return PROFILES.find((profile) => profile.id === userId) ?? null;
}

export async function readActor(): Promise<{ actor: Actor; companyId: string | null } | null> {
  const jar = await cookies();
  const userId = jar.get(USER_COOKIE)?.value;
  if (!userId) return null;
  const actor = await loadActor(db(), userId);
  if (!actor) return null;
  const requested = jar.get(COMPANY_COOKIE)?.value ?? null;
  const companyId =
    requested && actor.memberships.some((membership) => membership.companyId === requested)
      ? requested
      : null;
  return { actor, companyId };
}

/** Cursor sign-in. The demo profile cookie is not authentication. */
export async function requireViewer() {
  const identity = await requireIdentity(await headers());
  if (identity instanceof Response) {
    throw new AppError("Inicia sesión en Cursor para usar el laboratorio.", 401, "NO_VIEWER");
  }
  return identity;
}

/** Pages answer 401 when Cursor has not signed the viewer in. */
export async function requirePageViewer() {
  const identity = await requireIdentity(await headers());
  if (identity instanceof Response) unauthorized();
  return identity;
}

export async function requireActor(): Promise<{ actor: Actor; companyId: string | null }> {
  await requireViewer();
  const session = await readActor();
  if (!session) throw new AppError("No hay una sesión de laboratorio.", 401, "NO_SESSION");
  return session;
}

export function defaultCompany(userId: string): string {
  return PROFILE_COMPANY[userId] ?? "";
}

import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { PROFILE_COMPANY, PROFILES } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { hasAccess } from "@/server/access";
import { db } from "@/server/db";
import { isDemoOwner } from "@/server/owner";
import { getShell, loadActor } from "@/server/queries";

export const USER_COOKIE = "serbell_user";
export const COMPANY_COOKIE = "serbell_company";

/**
 * Shared sandbox key for anonymous visitors of a public app. When the app is
 * published Private or Team, Cursor signs the viewer in and we use their own
 * stable `sub` instead, so each signed-in person keeps a separate profile. A
 * forged value cannot reach here: an identity is only trusted when Cursor
 * signed it, and everyone else simply shares this one demo sandbox, which has
 * nothing privileged to escalate into.
 */
const PUBLIC_VIEWER_SUB = "public-demo";

export function profileById(userId: string) {
  return PROFILES.find((profile) => profile.id === userId) ?? null;
}

/** The storage key for this request's demo profile. */
export async function currentViewerSub(): Promise<string> {
  const identity = await getIdentity(await headers());
  if (identity.verified && isDemoOwner(identity)) return identity.sub;
  return PUBLIC_VIEWER_SUB;
}

/** Reject the request unless the visitor passed the access gate (hosted only). */
async function requireAccess() {
  if (!(await hasAccess())) {
    throw new AppError("Escribe la contraseña para entrar al laboratorio.", 401, "NO_ACCESS");
  }
}

/** A gate for API routes: the visitor must have passed the password gate. Returns the viewer key. */
export async function requireViewer(): Promise<string> {
  await requireAccess();
  return currentViewerSub();
}

async function actorFromBinding(viewerSub: string) {
  const saved = await db().demoBinding.findUnique({ where: { viewerSub } });
  if (!saved || !profileById(saved.profileId)) return null;
  const actor = await loadActor(db(), saved.profileId);
  if (!actor) return null;
  const companyId = actor.memberships.some((membership) => membership.companyId === saved.companyId)
    ? saved.companyId
    : null;
  return { actor, companyId, viewerSub };
}

export async function saveDemoBinding(viewerSub: string, profileId: string) {
  if (!profileById(profileId)) throw new AppError("Ese perfil no existe.", 400, "UNKNOWN_PROFILE");
  const companyId = PROFILE_COMPANY[profileId] ?? "";
  await db().demoBinding.upsert({
    where: { viewerSub },
    create: { viewerSub, profileId, companyId },
    update: { profileId, companyId },
  });
}

export async function setDemoCompany(viewerSub: string, actor: Actor, companyId: string) {
  if (!actor.memberships.some((membership) => membership.companyId === companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  await db().demoBinding.update({ where: { viewerSub }, data: { companyId } });
}

/** Resolve (and, on first visit, create) the demo profile stored for this viewer. */
async function resolveSession(viewerSub: string) {
  const existing = await actorFromBinding(viewerSub);
  if (existing) return existing;
  await saveDemoBinding(viewerSub, PROFILES[0].id);
  return actorFromBinding(viewerSub);
}

export async function requireActor(): Promise<{ actor: Actor; companyId: string | null; viewerSub: string }> {
  await requireAccess();
  const viewerSub = await currentViewerSub();
  const session = await resolveSession(viewerSub);
  if (!session) throw new AppError("No hay una sesión de laboratorio.", 401, "NO_SESSION");
  return session;
}

export async function pageSession() {
  const viewerSub = await currentViewerSub();
  const session = await resolveSession(viewerSub);
  if (!session) return null;
  const shell = await getShell(db(), session.actor);
  return { ...session, companies: shell.companies };
}

export function defaultCompany(userId: string): string {
  return PROFILE_COMPANY[userId] ?? "";
}

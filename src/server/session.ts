import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { PROFILE_COMPANY, PROFILES, USER } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { db } from "@/server/db";
import { getShell, loadActor } from "@/server/queries";
import { isAnonymousViewer, resolveViewer } from "@/server/viewer";

export const USER_COOKIE = "serbell_user";
export const COMPANY_COOKIE = "serbell_company";

/**
 * An anonymous browser is pinned to the business-owner profile inside its own
 * database. It cannot switch into the accountant or the firm admin. Those
 * profiles exist only for a viewer Cursor has signed in.
 */
const PUBLIC_PROFILE = USER.padrino;
const PRIVILEGED_PROFILES = new Set<string>([USER.carlos, USER.ana]);

export function assertProfileAllowed(viewerSub: string, profileId: string, signedIn: boolean) {
  if (!profileById(profileId)) throw new AppError("Ese perfil no existe.", 400, "UNKNOWN_PROFILE");
  if (isAnonymousViewer(viewerSub) && profileId !== PUBLIC_PROFILE) {
    throw new AppError("En el enlace público solo se usa el perfil de propietario.", 403, "PROFILE_FORBIDDEN");
  }
  if (PRIVILEGED_PROFILES.has(profileId) && !signedIn) {
    throw new AppError("Ese perfil solo está disponible con sesión de Cursor.", 403, "PROFILE_FORBIDDEN");
  }
}

export function profileById(userId: string) {
  return PROFILES.find((profile) => profile.id === userId) ?? null;
}

/** The storage key for this request's demo profile. Each anonymous browser has its own. */
export async function currentViewerSub(): Promise<string> {
  const viewer = await resolveViewer();
  if (viewer) return viewer.sub;
  throw new AppError("No se pudo abrir tu copia del laboratorio.", 401, "NO_ACCESS");
}

/** The visitor key for this browser. Each browser has its own demo copy. */
export async function requireViewer(): Promise<string> {
  return currentViewerSub();
}

async function actorFromBinding(viewerSub: string) {
  const saved = await (await db()).demoBinding.findUnique({ where: { viewerSub } });
  if (!saved || !profileById(saved.profileId)) return null;
  const actor = await loadActor((await db()), saved.profileId);
  if (!actor) return null;
  const companyId = actor.memberships.some((membership) => membership.companyId === saved.companyId)
    ? saved.companyId
    : null;
  return { actor, companyId, viewerSub };
}

export async function privateIdentityPresent(): Promise<boolean> {
  const identity = await getIdentity(await headers());
  return identity.verified && identity.kind === "person";
}

export async function saveDemoBinding(viewerSub: string, profileId: string) {
  assertProfileAllowed(viewerSub, profileId, await privateIdentityPresent());
  const companyId = PROFILE_COMPANY[profileId] ?? "";
  await (await db()).demoBinding.upsert({
    where: { viewerSub },
    create: { viewerSub, profileId, companyId },
    update: { profileId, companyId },
  });
}

export async function setDemoCompany(viewerSub: string, actor: Actor, companyId: string) {
  if (!actor.memberships.some((membership) => membership.companyId === companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  await (await db()).demoBinding.update({ where: { viewerSub }, data: { companyId } });
}

/** Resolve (and, on first visit, create) the demo profile stored for this viewer. */
async function resolveSession(viewerSub: string) {
  const pinned = isAnonymousViewer(viewerSub) ? PUBLIC_PROFILE : null;
  const existing = await actorFromBinding(viewerSub);
  if (existing && (!pinned || existing.actor.id === pinned)) return existing;
  await saveDemoBinding(viewerSub, pinned ?? PROFILES[0].id);
  return actorFromBinding(viewerSub);
}

export async function requireActor(): Promise<{ actor: Actor; companyId: string | null; viewerSub: string }> {
  const viewerSub = await currentViewerSub();
  const session = await resolveSession(viewerSub);
  if (!session) throw new AppError("No hay una sesión de laboratorio.", 401, "NO_SESSION");
  return session;
}

export async function pageSession() {
  const viewer = await resolveViewer();
  if (!viewer) return null;
  const viewerSub = viewer.sub;
  const session = await resolveSession(viewerSub);
  if (!session) return null;
  const shell = await getShell((await db()), session.actor);
  return { ...session, companies: shell.companies, canSwitchProfiles: await privateIdentityPresent() };
}

export function defaultCompany(userId: string): string {
  return PROFILE_COMPANY[userId] ?? "";
}

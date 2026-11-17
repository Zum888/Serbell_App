import { headers } from "next/headers";
import { forbidden, unauthorized } from "next/navigation";
import { requireIdentity, type VerifiedIdentity } from "../../cursor/identity";
import { PROFILE_COMPANY, PROFILES } from "@/lib/ids";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { db } from "@/server/db";
import { isDemoOwner } from "@/server/owner";
import { getShell, loadActor } from "@/server/queries";

export const USER_COOKIE = "serbell_user";
export const COMPANY_COOKIE = "serbell_company";

export function profileById(userId: string) {
  return PROFILES.find((profile) => profile.id === userId) ?? null;
}

export async function requireViewer(): Promise<VerifiedIdentity> {
  const identity = await requireIdentity(await headers());
  if (identity instanceof Response) {
    throw new AppError("Inicia sesión en Cursor para usar el laboratorio.", 401, "NO_VIEWER");
  }
  if (!isDemoOwner(identity)) {
    throw new AppError("Solo quien publicó el laboratorio puede usar los perfiles.", 403, "NOT_OWNER");
  }
  return identity;
}

async function requirePageIdentity(): Promise<VerifiedIdentity> {
  const identity = await requireIdentity(await headers());
  if (identity instanceof Response) unauthorized();
  if (!isDemoOwner(identity)) forbidden();
  return identity;
}

async function actorFromBinding(identity: VerifiedIdentity) {
  const saved = await db().demoBinding.findUnique({ where: { viewerSub: identity.sub } });
  if (!saved || !profileById(saved.profileId)) return null;
  const actor = await loadActor(db(), saved.profileId);
  if (!actor) return null;
  const companyId = actor.memberships.some((membership) => membership.companyId === saved.companyId)
    ? saved.companyId
    : null;
  return { actor, companyId, viewerSub: identity.sub };
}

export async function saveDemoBinding(identity: VerifiedIdentity, profileId: string) {
  if (!isDemoOwner(identity)) {
    throw new AppError("Solo quien publicó el laboratorio puede usar los perfiles.", 403, "NOT_OWNER");
  }
  if (!profileById(profileId)) throw new AppError("Ese perfil no existe.", 400, "UNKNOWN_PROFILE");
  const companyId = PROFILE_COMPANY[profileId] ?? "";
  await db().demoBinding.upsert({
    where: { viewerSub: identity.sub },
    create: { viewerSub: identity.sub, profileId, companyId },
    update: { profileId, companyId },
  });
}

export async function setDemoCompany(viewerSub: string, actor: Actor, companyId: string) {
  if (!actor.memberships.some((membership) => membership.companyId === companyId)) {
    throw new AppError("El servidor rechazó la solicitud: no tienes acceso a esta empresa.", 403, "COMPANY_FORBIDDEN");
  }
  await db().demoBinding.update({ where: { viewerSub }, data: { companyId } });
}

/** The demo profile is the row stored for this viewer. An unsigned cookie is never read. */
export async function requireActor(): Promise<{ actor: Actor; companyId: string | null; viewerSub: string }> {
  const identity = await requireViewer();
  const session = await actorFromBinding(identity);
  if (!session) throw new AppError("No hay una sesión de laboratorio.", 401, "NO_SESSION");
  return session;
}

export async function pageSession() {
  const identity = await requirePageIdentity();
  const session = await actorFromBinding(identity);
  if (!session) return null;
  const shell = await getShell(db(), session.actor);
  return { ...session, companies: shell.companies, identity };
}

export function defaultCompany(userId: string): string {
  return PROFILE_COMPANY[userId] ?? "";
}

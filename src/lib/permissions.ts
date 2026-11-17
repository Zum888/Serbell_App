import { AppError } from "@/lib/errors";

export type MembershipRole = "BUSINESS_OWNER" | "ACCOUNTANT" | "FIRM_ADMIN";

export type Actor = {
  id: string;
  name: string;
  email: string;
  firmRole: "FIRM_ADMIN" | "ACCOUNTANT" | null;
  memberships: { companyId: string; role: MembershipRole }[];
};

export function companyRole(actor: Actor, companyId: string): MembershipRole | null {
  return actor.memberships.find((membership) => membership.companyId === companyId)?.role ?? null;
}

export function assertCompanyAccess(actor: Actor, companyId: string): MembershipRole {
  const role = companyRole(actor, companyId);
  if (!role) {
    throw new AppError(
      "El servidor rechazó la solicitud: no tienes acceso a esta empresa.",
      403,
      "COMPANY_FORBIDDEN",
    );
  }
  return role;
}

export function assertCanMutate(actor: Actor, companyId: string, sealedAt: Date | null): MembershipRole {
  const role = assertCompanyAccess(actor, companyId);
  if (sealedAt) {
    throw new AppError(
      "El servidor rechazó la edición: el movimiento está sellado.",
      403,
      "SEALED",
    );
  }
  return role;
}

export function assertCanSeal(actor: Actor, companyId: string): MembershipRole {
  const role = assertCompanyAccess(actor, companyId);
  if (role === "BUSINESS_OWNER") {
    throw new AppError(
      "El servidor rechazó el sello: el propietario no puede sellar.",
      403,
      "SEAL_FORBIDDEN",
    );
  }
  return role;
}

export function assertCanReopen(actor: Actor, companyId: string): void {
  assertCompanyAccess(actor, companyId);
  if (actor.firmRole !== "FIRM_ADMIN") {
    throw new AppError(
      "El servidor rechazó la reapertura: solo la administración de la firma puede reabrir un sello.",
      403,
      "REOPEN_FORBIDDEN",
    );
  }
}

export function canReview(actor: Actor, companyId: string): boolean {
  const role = companyRole(actor, companyId);
  return role === "ACCOUNTANT" || role === "FIRM_ADMIN";
}

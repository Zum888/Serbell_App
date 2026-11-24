import { Bell, Building2, ChevronDown } from "lucide-react";
import { PROFILES } from "@/lib/ids";
import type { Actor } from "@/lib/permissions";
import { SideRail } from "@/components/side-rail";
import { PostLink } from "@/components/post-link";
import { Simulator } from "@/components/simulator";

export function Shell({
  actor,
  companies,
  companyId,
  canSwitchProfiles,
  children,
}: {
  actor: Actor;
  companies: { id: string; name: string; industry: string }[];
  companyId: string | null;
  canSwitchProfiles: boolean;
  children: React.ReactNode;
}) {
  const profile = PROFILES.find((item) => item.id === actor.id);
  const company = companies.find((item) => item.id === companyId);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <SideRail firm={Boolean(actor.firmRole)} homeHref={actor.firmRole ? "/firma" : "/"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4">
          <div>
            {companies.length > 1 ? (
              <details className="relative">
                <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  <Building2 className="size-4 text-slate-500" />
                  {company?.name ?? "Selecciona una empresa"}
                  <ChevronDown className="size-4 text-slate-400" />
                </summary>
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-border bg-white p-1 shadow-sm">
                  {companies.map((item) => (
                    <PostLink
                      key={item.id}
                      action="/api/session/company"
                      fields={{ companyId: item.id, next: "/movimientos" }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-xs text-muted">{item.industry}</span>
                    </PostLink>
                  ))}
                </div>
              </details>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium">
                <Building2 className="size-4 text-slate-500" />
                {company?.name ?? companies[0]?.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Simulator />
            <details className="relative">
              <summary className="flex size-9 cursor-pointer items-center justify-center rounded-full text-slate-500" aria-label="Notificaciones">
                <Bell className="size-4" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-white p-3 text-sm text-slate-600 shadow-sm">
                No hay notificaciones.
              </div>
            </details>
            <details className="relative">
              <summary data-testid="profile-switcher" className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                  {profile?.initials}
                </span>
                <span className="text-left">
                  <span className="block font-medium">{profile?.name}</span>
                  <span className="block text-xs text-muted">{profile?.role}</span>
                </span>
                <ChevronDown className="size-4 text-slate-400" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-white p-1 shadow-sm">
                <p className="px-3 py-2 text-xs text-muted">
                  {canSwitchProfiles ? "Perfil de demostración, con tu sesión de Cursor." : "Enlace público: perfil de propietario."}
                </p>
                {(canSwitchProfiles ? PROFILES : PROFILES.filter((item) => item.id === actor.id)).map((item) =>
                  canSwitchProfiles ? (
                    <PostLink
                      key={item.id}
                      action="/api/session/enter"
                      fields={{ user: item.id, next: item.home }}
                      testId={`profile-option-${item.id}`}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-xs text-muted">
                        {item.role} · {item.company}
                      </span>
                    </PostLink>
                  ) : (
                    <p key={item.id} className="px-3 py-2 text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-xs text-muted">{item.role} · {item.company}</span>
                    </p>
                  ),
                )}
              </div>
            </details>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}

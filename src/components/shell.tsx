import { Bell, Building2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { PROFILES } from "@/lib/ids";
import type { Actor } from "@/lib/permissions";
import { SideNav } from "@/components/nav";

export function Shell({
  actor,
  companies,
  companyId,
  children,
}: {
  actor: Actor;
  companies: { id: string; name: string; industry: string }[];
  companyId: string | null;
  children: React.ReactNode;
}) {
  const profile = PROFILES.find((item) => item.id === actor.id);
  const company = companies.find((item) => item.id === companyId);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-white py-4">
        <Link href={actor.firmRole ? "/firma" : "/"} className="px-5 pb-5">
          <img src="/brand/serbell-logo.png" alt="Serbell" className="h-8 w-auto" />
        </Link>
        <SideNav firm={Boolean(actor.firmRole)} />
      </aside>
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
                    <a
                      key={item.id}
                      href={`/api/session/company?companyId=${item.id}&next=/movimientos`}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-xs text-muted">{item.industry}</span>
                    </a>
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
                <p className="px-3 py-2 text-xs text-muted">Perfil de laboratorio. No pide contraseña.</p>
                {PROFILES.map((item) => (
                  <a
                    key={item.id}
                    data-testid={`profile-option-${item.id}`}
                    href={`/api/session/enter?user=${item.id}&next=${encodeURIComponent(item.home)}`}
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-xs text-muted">
                      {item.role} · {item.company}
                    </span>
                  </a>
                ))}
              </div>
            </details>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}

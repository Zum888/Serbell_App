"use client";

import {
  Landmark,
  BarChart3,
  CircleHelp,
  FileText,
  Plus,
  Receipt,
  Settings,
  Tags,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", firmHref: "/firma", label: "Nuevo chat", icon: Plus, testId: "nav-inicio", create: true },
  { href: "/movimientos", label: "Bancos", icon: Landmark, testId: "nav-movimientos" },
  { href: "/comprobantes", label: "Comprobantes", icon: FileText, testId: "nav-comprobantes" },
  { href: "/categorias", label: "Categorías", icon: Tags, testId: "nav-categorias" },
  { href: "/por-cobrar", label: "Por cobrar", icon: Wallet, testId: "nav-cobrar" },
  { href: "/por-pagar", label: "Por pagar", icon: Receipt, testId: "nav-pagar" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, testId: "nav-reportes" },
  { href: "/configuracion", label: "Configuración", icon: Settings, testId: "nav-configuracion" },
];

export function SideNav({ firm, collapsed = false }: { firm: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {items.map((item) => {
        const href = "firmHref" in item && item.firmHref && firm ? item.firmHref : item.href;
        const active = pathname === href || (href === "/movimientos" && pathname.startsWith("/cuentas"));
        const Icon = item.icon;
        const create = "create" in item && item.create;
        return (
          <Link
            key={item.testId}
            href={href}
            data-testid={item.testId}
            title={collapsed ? item.label : undefined}
            onClick={(event) => {
              if (!create) return;
              window.dispatchEvent(new Event("serbell-chat-reset"));
              if (pathname === href) event.preventDefault();
            }}
            className={cn(
              "flex w-full items-center rounded-xl py-2 text-sm",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
              create ? "font-medium text-stone-900" : "text-slate-600",
              active && "bg-[#efede8]",
              !create && active && "font-medium text-stone-900",
            )}
          >
            {create ? (
              <>
                {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-md bg-stone-900 text-[#f7f6f4]", collapsed ? "" : "ml-auto")}>
                  <Plus className="size-3.5" strokeWidth={2.5} />
                </span>
              </>
            ) : (
              <>
                <Icon className="size-4 shrink-0" />
                {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
              </>
            )}
          </Link>
        );
      })}
      <Link href="/ayuda" title={collapsed ? "Ayuda" : undefined} className={cn("mt-auto flex items-center rounded-xl py-2 text-sm text-slate-500", collapsed ? "justify-center px-2" : "gap-3 px-3")}>
        <CircleHelp className="size-4 shrink-0" />
        {collapsed ? <span className="sr-only">Ayuda</span> : "Ayuda"}
      </Link>
    </nav>
  );
}

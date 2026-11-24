"use client";

import {
  Landmark,
  BarChart3,
  CircleHelp,
  FileText,
  MessageSquare,
  Receipt,
  Settings,
  Tags,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", firmHref: "/firma", label: "Chat nuevo", icon: MessageSquare, testId: "nav-inicio" },
  { href: "/movimientos", label: "Bancos", icon: Landmark, testId: "nav-movimientos" },
  { href: "/comprobantes", label: "Comprobantes", icon: FileText, testId: "nav-comprobantes" },
  { href: "/categorias", label: "Categorías", icon: Tags, testId: "nav-categorias" },
  { href: "/por-cobrar", label: "Por cobrar", icon: Wallet, testId: "nav-cobrar" },
  { href: "/por-pagar", label: "Por pagar", icon: Receipt, testId: "nav-pagar" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, testId: "nav-reportes" },
  { href: "/configuracion", label: "Configuración", icon: Settings, testId: "nav-configuracion" },
];

const DOCK = ["/movimientos", "/cuentas", "/por-cobrar", "/por-pagar", "/reportes", "/categorias"];

export function SideNav({ firm, collapsed = false }: { firm: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex flex-1 flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {items.map((item) => {
        const href = item.firmHref && firm ? item.firmHref : item.href;
        const active = pathname === href || (href === "/movimientos" && pathname.startsWith("/cuentas"));
        const Icon = item.icon;
        return (
          <Link
            key={item.testId}
            href={href}
            data-testid={item.testId}
            title={collapsed ? item.label : undefined}
            onClick={(event) => {
              if (item.testId !== "nav-inicio") return;
              window.dispatchEvent(new Event("serbell-chat-reset"));
              const stays = pathname === "/" || DOCK.some((path) => pathname === path || pathname.startsWith(`${path}/`));
              if (stays) event.preventDefault();
            }}
            className={cn(
              "flex items-center rounded-xl py-2 text-sm text-slate-600",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
              active && "bg-[#efede8] font-medium text-stone-900",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
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

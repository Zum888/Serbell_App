"use client";

import {
  ArrowLeftRight,
  BarChart3,
  CircleHelp,
  FileText,
  House,
  Landmark,
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
  { href: "/", firmHref: "/firma", label: "Inicio", icon: House, testId: "nav-inicio" },
  { href: "/chat", label: "Chat con Serbell", icon: MessageSquare, testId: "nav-chat" },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight, testId: "nav-movimientos" },
  { href: "/cuentas", label: "Cuentas bancarias", icon: Landmark, testId: "nav-cuentas" },
  { href: "/comprobantes", label: "Comprobantes", icon: FileText, testId: "nav-comprobantes" },
  { href: "/categorias", label: "Categorías", icon: Tags, testId: "nav-categorias" },
  { href: "/por-cobrar", label: "Por cobrar", icon: Wallet, testId: "nav-cobrar" },
  { href: "/por-pagar", label: "Por pagar", icon: Receipt, testId: "nav-pagar" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, testId: "nav-reportes" },
  { href: "/configuracion", label: "Configuración", icon: Settings, testId: "nav-configuracion" },
];

export function SideNav({ firm }: { firm: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const href = item.firmHref && firm ? item.firmHref : item.href;
        const active = pathname === href;
        const Icon = item.icon;
        return (
          <Link
            key={item.testId}
            href={href}
            data-testid={item.testId}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600",
              active && "bg-blue-50 font-medium text-primary",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <Link href="/ayuda" className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500">
        <CircleHelp className="size-4" />
        Ayuda
      </Link>
    </nav>
  );
}

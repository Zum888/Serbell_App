"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SideNav } from "@/components/nav";

const KEY = "serbell-nav-collapsed";

export function SideRail({ firm, homeHref }: { firm: boolean; homeHref: string }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      data-testid="side-nav"
      data-collapsed={collapsed ? "true" : "false"}
      className={collapsed ? "flex w-[68px] shrink-0 flex-col border-r border-border bg-white py-4" : "flex w-[232px] shrink-0 flex-col border-r border-border bg-white py-4"}
    >
      <div className={collapsed ? "flex justify-center px-2 pb-4" : "flex items-center justify-between gap-2 px-4 pb-4"}>
        {collapsed ? null : (
          <Link href={homeHref} className="min-w-0">
            <img src="/brand/serbell-logo.png" alt="Serbell" width={68} height={32} className="h-8 w-auto" />
          </Link>
        )}
        <button
          type="button"
          data-testid="nav-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Abrir el menú" : "Retraer el menú"}
          title={collapsed ? "Abrir el menú" : "Retraer el menú"}
          onClick={toggle}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-[#efede8] hover:text-stone-900"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <SideNav firm={firm} collapsed={collapsed} />
    </aside>
  );
}

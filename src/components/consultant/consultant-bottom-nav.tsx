"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List } from "lucide-react";

const NAV = [
  { href: "/consultor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/consultor",           label: "Leads",     icon: List },
];

export function ConsultantBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[var(--surface)] pb-safe">
      <div className="flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/consultor" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-colors ${
                active ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, LogOut, Menu, Settings, ShoppingBag, Upload, Users, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { signOutAction } from "@/lib/auth/actions";

const nav = [
  { href: "/",             label: "Visão geral",   icon: LayoutDashboard, badge: false },
  { href: "/leads",        label: "Leads",         icon: Users,           badge: false },
  { href: "/sales",        label: "Vendas",        icon: ShoppingBag,     badge: false },
  { href: "/import",       label: "Importar",      icon: Upload,          badge: false },
  { href: "/notifications",label: "Notificações",  icon: Bell,            badge: true  },
  { href: "/settings",     label: "Configurações", icon: Settings,        badge: false },
];

interface SidebarProps {
  clientName:   string;
  unreadCount?: number;
}

export function Sidebar({ clientName, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  function renderLinks() {
    return (
      <nav className="space-y-1">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active  = isActive(href);
          const showBadge = badge && unreadCount > 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-[var(--shadow-accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-white/15 text-white"
                    : "bg-[var(--surface-muted)] text-[var(--accent)] group-hover:bg-[var(--accent-soft)] group-hover:scale-110"
                }`}
              >
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* ─── Mobile top bar ──────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="page-shell flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow-[var(--shadow-accent)]">
              <span className="text-xs font-black text-white">F</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--text-muted)]">Fonil Sales</p>
              <p className="truncate text-sm font-semibold text-[var(--text)] leading-tight">{clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            {unreadCount > 0 && (
              <Link
                href="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]"
              >
                <Bell size={16} />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger)] text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              aria-label="Abrir navegação"
            >
              <Menu size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Mobile drawer ─────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 xl:hidden transition-all duration-300 ${
          mobileOpen ? "visible" : "invisible"
        }`}
      >
        <button
          type="button"
          aria-label="Fechar navegação"
          className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`relative h-full w-[86vw] max-w-sm card m-3 flex flex-col p-4 transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-[110%]"
          }`}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow-[var(--shadow-accent)]">
                <span className="text-sm font-black text-white">F</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--text-muted)]">Fonil Sales</p>
                <p className="truncate text-sm font-semibold text-[var(--text)]">{clientName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">{renderLinks()}</div>

          <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
                  <LogOut size={15} />
                </span>
                Sair
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* ─── Desktop sidebar ─────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]/92 p-4 backdrop-blur-xl xl:flex xl:flex-col">
        <div className="card flex h-full flex-col p-4">

          {/* Brand */}
          <div className="border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow-[var(--shadow-accent)]">
                <span className="text-sm font-black text-white">F</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">Fonil Sales</p>
                <p className="truncate text-sm font-semibold text-[var(--text)] leading-tight mt-0.5">{clientName}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto py-4">{renderLinks()}</div>

          {/* Theme + Logout */}
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
                  <LogOut size={15} />
                </span>
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

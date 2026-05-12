export const dynamic = "force-dynamic";

import { AlertCircle, Bell, CheckCircle, Info, TriangleAlert, ChevronRight, Clock, UserCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { markAllNotificationsReadAction } from "./actions";
import type { NotificationType } from "@prisma/client";

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bell; iconClass: string; label: string }
> = {
  TRACKING_ERROR:         { icon: AlertCircle,   iconClass: "bg-[var(--danger-soft)] text-[var(--danger)]",   label: "Falha de tracking" },
  TRACKING_TOKEN_INVALID: { icon: AlertCircle,   iconClass: "bg-[var(--danger-soft)] text-[var(--danger)]",   label: "Token inválido" },
  IMPORT_COMPLETE:        { icon: CheckCircle,   iconClass: "bg-[var(--success-soft)] text-[var(--success)]", label: "Importação concluída" },
  IMPORT_ERROR:           { icon: TriangleAlert, iconClass: "bg-[var(--warning-soft)] text-[var(--warning)]", label: "Erro de importação" },
  LOW_EMAIL_COVERAGE:     { icon: Info,          iconClass: "bg-[var(--accent-soft)] text-[var(--accent)]",   label: "Cobertura de email baixa" },
  SPEED_TO_LEAD:          { icon: Clock,         iconClass: "bg-[var(--danger-soft)] text-[var(--danger)]",   label: "Speed-to-lead" },
  ACTIVATION_ALERT:       { icon: UserCheck,     iconClass: "bg-[var(--warning-soft)] text-[var(--warning)]", label: "Cadastro parado" },
  LTV_REACTIVATION:       { icon: RefreshCw,     iconClass: "bg-[var(--accent-soft)] text-[var(--accent)]",   label: "Reativação LTV" },
};

function extractLeadId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return (metadata as Record<string, unknown>).leadId as string | null;
}

export default async function NotificationsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const notifications = await prisma.notification.findMany({
    where:   { clientId },
    orderBy: { createdAt: "desc" },
    take:    200,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Notificações</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo lido"}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="btn-secondary px-4 py-2 text-sm">
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
            <Bell size={22} />
          </div>
          <p className="text-sm font-semibold text-[var(--text)]">Sem notificações</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Eventos de tracking e importações aparecerão aqui</p>
        </div>
      ) : (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {notifications.map((n) => {
            const cfg    = typeConfig[n.type];
            const Icon   = cfg.icon;
            const leadId = extractLeadId(n.metadata);
            const href   = leadId ? `/leads/${leadId}` : null;

            const inner = (
              <>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.iconClass}`}>
                  <Icon size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {cfg.label}
                    </p>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text)]">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{n.body}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <time className="text-xs text-[var(--text-muted)]">
                    {new Date(n.createdAt).toLocaleDateString("pt-BR")}
                  </time>
                  {href && <ChevronRight size={15} className="text-[var(--text-muted)]" />}
                </div>
              </>
            );

            const rowClass = `flex items-start gap-4 px-5 py-4 transition-colors ${
              !n.isRead ? "bg-[var(--accent-soft)]/30" : ""
            } ${href ? "hover:bg-[var(--surface-muted)] cursor-pointer" : ""}`;

            return href ? (
              <Link key={n.id} href={href} className={rowClass}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} className={rowClass}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

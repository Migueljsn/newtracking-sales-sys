import { getSession } from "@/lib/auth/session";
import { stopImpersonatingAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/ui/sidebar";
import { ImpersonationBanner } from "@/components/ui/impersonation-banner";
import { QueryProvider } from "@/providers/query-provider";
import { getOrSet } from "@/lib/cache/get-or-set";
import { cacheKeys } from "@/lib/cache/invalidate";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const unreadCount = await getOrSet(
    cacheKeys.unreadCount(session.clientId!),
    30,
    () => prisma.notification.count({ where: { clientId: session.clientId, isRead: false } })
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {session.isImpersonating && (
        <ImpersonationBanner
          clientName={session.client.name}
          stopAction={stopImpersonatingAction}
        />
      )}
      <div className="flex flex-1 min-h-0">
        <Sidebar clientName={session.client.name} unreadCount={unreadCount} />
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
            <QueryProvider>
              {children}
            </QueryProvider>
          </div>
        </main>
      </div>
    </div>
  );
}

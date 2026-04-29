import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const unreadCount = await prisma.notification.count({
    where: { clientId: session.clientId!, isRead: false },
  });

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar clientName={session.client.name} unreadCount={unreadCount} />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

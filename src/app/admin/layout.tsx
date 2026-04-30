import { getAdminSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <AdminSidebar adminName={session.name} />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

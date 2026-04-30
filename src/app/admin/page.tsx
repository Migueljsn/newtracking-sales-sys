export const dynamic = "force-dynamic";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ClientsTable } from "@/components/admin/clients-table";
import { CreateClientModal } from "@/components/admin/create-client-modal";

export default async function AdminClientsPage() {
  await getAdminSession();

  const clients = await prisma.client.findMany({
    include: {
      user: { select: { email: true, name: true } },
      _count: { select: { leads: true, sales: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Admin</p>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Clientes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{clients.length} clientes cadastrados</p>
        </div>
        <CreateClientModal />
      </div>

      <ClientsTable clients={clients} />
    </div>
  );
}

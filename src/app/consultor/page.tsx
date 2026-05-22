export const dynamic = "force-dynamic";

import { getConsultantSession } from "@/lib/auth/consultant-session";
import { prisma } from "@/lib/db/prisma";
import { ConsultantLeadsTable } from "@/components/consultant/consultant-leads-table";
import { consultantLogoutAction } from "./actions";
import { LogOut } from "lucide-react";

export default async function ConsultantPage() {
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  const [settings, pipelineStages] = await Promise.all([
    prisma.clientSettings.findUnique({ where: { clientId }, select: { consultants: true, whatsappTemplate: true } }),
    prisma.pipelineStage.findMany({ where: { clientId }, orderBy: { position: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Portal CRM</p>
          <p className="text-sm font-semibold text-[var(--text)]">Olá, {session.name}</p>
        </div>
        <form action={consultantLogoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
          >
            <LogOut size={13} /> Sair
          </button>
        </form>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-[var(--text)]">Leads</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Lista operacional de leads</p>
        </div>

        <ConsultantLeadsTable
          consultantName={session.name}
          pipelineStages={pipelineStages}
          consultants={settings?.consultants ?? []}
          whatsappTemplate={settings?.whatsappTemplate ?? null}
        />
      </main>
    </div>
  );
}

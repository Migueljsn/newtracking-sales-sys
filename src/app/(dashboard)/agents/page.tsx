export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth/session";
import { prisma }     from "@/lib/db/prisma";
import { AgentsTab }  from "@/components/agents/agents-tab";

export default async function AgentsPage() {
  const session  = await getSession();
  const clientId = session.clientId!;

  const agents = await prisma.aiAgent.findMany({
    where:   { clientId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Agentes IA</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Agentes conversacionais que atendem leads automaticamente via WhatsApp
        </p>
      </div>
      <AgentsTab agents={agents} />
    </div>
  );
}

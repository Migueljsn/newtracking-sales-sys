export const dynamic = "force-dynamic";

import { getSession }              from "@/lib/auth/session";
import { fetchComunicacoesStats }  from "@/lib/queries/comunicacoes";
import { ComunicacoesView }        from "@/components/comunicacoes/comunicacoes-view";

const VALID_TABS = ["visao-geral", "email", "whatsapp", "historico"] as const;
type Tab = typeof VALID_TABS[number];

function parseDate(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function ComunicacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; dias?: string; de?: string; ate?: string }>;
}) {
  const session  = await getSession();
  const clientId = session.clientId!;
  const params   = await searchParams;

  const activeTab = (VALID_TABS.includes(params.aba as Tab) ? params.aba : "visao-geral") as Tab;

  const fromDate = parseDate(params.de);
  const toDate   = parseDate(params.ate);
  const days     = fromDate ? undefined : Math.min(Math.max(Number(params.dias) || 30, 7), 90);

  // toDate receives end of day so the whole day is included
  const toDateEod = toDate ? new Date(toDate.getTime() + 86_399_999) : undefined;

  const stats = await fetchComunicacoesStats(clientId, days ?? 30, fromDate, toDateEod);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Comunicações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Métricas de disparos por canal — e-mail e WhatsApp
        </p>
      </div>
      <ComunicacoesView
        stats={stats}
        activeTab={activeTab}
        days={days ?? 0}
        customFrom={params.de}
        customTo={params.ate}
      />
    </div>
  );
}

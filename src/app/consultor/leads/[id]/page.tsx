export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Square, ListChecks, MessageSquare, Phone, MessageCircle, Calendar, Mail, Tag, MessageCircleMore } from "lucide-react";
import { getConsultantSession } from "@/lib/auth/consultant-session";
import { prisma } from "@/lib/db/prisma";
import { fetchLeadDetail } from "@/lib/queries/lead-detail";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { WhatsAppButton } from "@/components/leads/whatsapp-button";
import { ConsultantLeadDetailActions } from "@/components/consultant/consultant-lead-detail-actions";

const interactionTypeLabel: Record<string, string> = {
  NOTE:             "Anotação",
  CALL:             "Ligação",
  WHATSAPP:         "WhatsApp",
  WHATSAPP_INBOUND: "Resposta WhatsApp",
  MEETING:          "Reunião",
  EMAIL:            "E-mail",
  OTHER:            "Outro",
};

const interactionTypeIcon: Record<string, React.ReactNode> = {
  NOTE:             <MessageSquare size={13} />,
  CALL:             <Phone size={13} />,
  WHATSAPP:         <MessageCircle size={13} />,
  WHATSAPP_INBOUND: <MessageCircleMore size={13} />,
  MEETING:          <Calendar size={13} />,
  EMAIL:            <Mail size={13} />,
  OTHER:            <Tag size={13} />,
};

export default async function ConsultantLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session  = await getConsultantSession();
  const clientId = session.clientId;

  const [lead, settings, pipelineStages] = await Promise.all([
    fetchLeadDetail(id, clientId),
    prisma.clientSettings.findUnique({
      where:  { clientId },
      select: { whatsappTemplate: true },
    }),
    prisma.pipelineStage.findMany({
      where:   { clientId },
      orderBy: { position: "asc" },
      select:  { id: true, name: true, color: true },
    }),
  ]);

  if (!lead) notFound();

  const [checklists, stageRequirements] = await Promise.all([
    prisma.leadChecklist.findMany({
      where:   { leadId: id },
      include: {
        requirement: {
          select: {
            id:    true,
            text:  true,
            stage: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { checkedAt: "desc" },
    }),
    lead.pipelineStageId
      ? prisma.pipelineStageRequirement.findMany({
          where:   { stageId: lead.pipelineStageId },
          orderBy: { position: "asc" },
          select:  { id: true, text: true },
        })
      : Promise.resolve([]),
  ]);

  const { customer } = lead;
  const totalSalesValue = lead.sales.reduce((sum, s) => sum + Number(s.value), 0);

  // Build timeline
  type TEvent =
    | { kind: "interaction"; id: string; content: string; type: string; createdAt: Date; createdBy: string | null }
    | { kind: "status";      id: string; to: string; createdAt: Date; changedBy: string | null }
    | { kind: "sale";        id: string; value: number; soldAt: Date }
    | { kind: "captured";    id: string; createdAt: Date };

  function eventDate(e: TEvent): number {
    if (e.kind === "sale") return e.soldAt.getTime();
    return e.createdAt.getTime();
  }

  const timeline: TEvent[] = ([
    { kind: "captured",    id: "cap", createdAt: new Date(lead.capturedAt) } satisfies TEvent,
    ...lead.interactions.map((i): TEvent => ({
      kind: "interaction", id: i.id, content: i.content, type: i.type,
      createdAt: new Date(i.createdAt), createdBy: i.createdBy,
    })),
    ...(lead.statusHistory ?? []).map((h): TEvent => ({
      kind: "status", id: h.id, to: h.to,
      createdAt: new Date(h.createdAt), changedBy: h.changedBy,
    })),
    ...lead.sales.map((s): TEvent => ({
      kind: "sale", id: s.id, value: Number(s.value), soldAt: new Date(s.soldAt),
    })),
  ] as TEvent[]).sort((a, b) => eventDate(b) - eventDate(a));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/consultor"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)]">Portal CRM</p>
            <p className="truncate text-sm font-semibold text-[var(--text)]">{customer.name}</p>
          </div>
        </div>
        <LeadStatusBadge status={lead.status} pipelineStage={lead.pipelineStage} />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-5">
        {/* Contact info */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">Dados do contato</h2>
          <dl className="space-y-3">
            {[
              { label: "Telefone",   value: customer.phone },
              { label: "Email",      value: customer.email },
              { label: "CPF / CNPJ", value: customer.document },
              {
                label: "Localização",
                value: customer.city || customer.state
                  ? [customer.city, customer.state].filter(Boolean).join(" / ")
                  : null,
              },
              { label: "Consultor",  value: lead.consultant },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-[var(--text-muted)]">{label}</dt>
                  <dd className="text-right text-[var(--text)] font-medium max-w-[60%] truncate">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
          {lead.notes && (
            <div className="text-sm">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Observações</p>
              <p className="whitespace-pre-line rounded-lg bg-[var(--bg)] p-3 text-xs text-[var(--text)]">
                {lead.notes}
              </p>
            </div>
          )}
          {customer.phone && (
            <WhatsAppButton
              phone={customer.phone}
              name={customer.name}
              state={customer.state}
              city={customer.city}
              template={settings?.whatsappTemplate}
            />
          )}
        </div>

        {/* Actions (client component) */}
        <ConsultantLeadDetailActions
          lead={{
            id:              lead.id,
            status:          lead.status,
            pipelineStageId: lead.pipelineStageId,
            pipelineStage:   lead.pipelineStage,
            customer: {
              name:     customer.name,
              document: customer.document,
              phone:    customer.phone,
            },
          }}
          pipelineStages={pipelineStages}
        />

        {/* Sales history */}
        {lead.sales.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Vendas ({lead.sales.length})
              </h2>
              {lead.sales.length > 1 && (
                <span className="text-sm font-semibold text-[var(--success)]">
                  Total:{" "}
                  {totalSalesValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {lead.sales.map((sale, idx) => (
                <div
                  key={sale.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-semibold text-[var(--success)]">
                      {Number(sale.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    {idx === 0 && lead.sales.length > 1 && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                        Mais recente
                      </span>
                    )}
                    {sale.isRepeatPurchase && (
                      <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        Recompra
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {new Date(sale.soldAt).toLocaleDateString("pt-BR")}
                  </p>
                  {sale.notes && (
                    <p className="text-xs text-[var(--text)] bg-[var(--bg)] rounded-lg px-3 py-2 mt-2">
                      {sale.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist */}
        {lead.pipelineStage && stageRequirements.length > 0 && (() => {
          const checkedMap = new Map(checklists.map(c => [c.requirementId, c]));
          return (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ListChecks size={15} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text)]">Checklist da etapa</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${lead.pipelineStage.color}22`,
                    color:           lead.pipelineStage.color,
                  }}
                >
                  {lead.pipelineStage.name}
                </span>
              </div>
              <div className="space-y-2">
                {stageRequirements.map((req, idx) => {
                  const entry = checkedMap.get(req.id);
                  return (
                    <div
                      key={req.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 ${
                        entry?.checked
                          ? "border-[var(--success)] bg-[var(--success-soft)]"
                          : "border-[var(--border)] bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${entry?.checked ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}>
                        {entry?.checked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${entry?.checked ? "text-[var(--text)] font-medium" : "text-[var(--text-muted)]"}`}>
                          {idx + 1}. {req.text}
                        </p>
                        {entry?.checked && (entry.checkedBy || entry.checkedAt) && (
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {entry.checkedBy && <span className="font-medium">{entry.checkedBy}</span>}
                            {entry.checkedAt && (
                              <span> · {new Date(entry.checkedAt).toLocaleDateString("pt-BR")}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Interactions timeline */}
        {timeline.length > 1 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Histórico</h2>
            <div className="space-y-3">
              {timeline.map(item => {
                if (item.kind === "captured") {
                  return (
                    <div key={item.id} className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border)]" />
                      <span>Lead capturada em {item.createdAt.toLocaleDateString("pt-BR")}</span>
                    </div>
                  );
                }

                if (item.kind === "sale") {
                  return (
                    <div key={item.id} className="flex items-center gap-3 text-xs">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)]" />
                      <span className="font-semibold text-[var(--success)]">
                        Venda:{" "}
                        {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {item.soldAt.toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  );
                }

                if (item.kind === "status") {
                  const stageName = pipelineStages.find(s => s.id === item.to)?.name ?? item.to;
                  return (
                    <div key={item.id} className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span>
                        Movida para{" "}
                        <strong className="text-[var(--text)]">{stageName}</strong>
                        {item.changedBy ? ` por ${item.changedBy}` : ""}
                      </span>
                      <span>{item.createdAt.toLocaleDateString("pt-BR")}</span>
                    </div>
                  );
                }

                // interaction
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        {interactionTypeIcon[item.type] ?? <Tag size={13} />}
                        <span className="text-[10px] font-semibold uppercase tracking-wider">
                          {interactionTypeLabel[item.type] ?? item.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {item.createdAt.toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text)]">{item.content}</p>
                    {item.createdBy && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">{item.createdBy}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

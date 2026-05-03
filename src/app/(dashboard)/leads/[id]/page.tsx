export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { fetchLeadDetail } from "@/lib/queries/lead-detail";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { RegisterSaleModal } from "@/components/leads/register-sale-modal";
import { RegisterLtvSaleModal } from "@/components/leads/register-ltv-sale-modal";
import { MarkLostButton } from "@/components/leads/mark-lost-button";
import { EditCustomerModal } from "@/components/leads/edit-customer-modal";
import { EditLeadModal } from "@/components/leads/edit-lead-modal";
import { EditSaleModal } from "@/components/leads/edit-sale-modal";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { DeleteSaleButton } from "@/components/leads/delete-sale-button";
import { GuideCard } from "@/components/ui/guide-card";

const trackingStatusLabel: Record<string, string> = {
  PENDING: "Pendente",
  SUCCESS: "Enviado",
  FAILED:  "Falhou",
  SKIPPED: "Ignorado",
};

const trackingStatusColor: Record<string, string> = {
  PENDING: "bg-[var(--warning-soft)] text-[var(--warning)]",
  SUCCESS: "bg-[var(--success-soft)] text-[var(--success)]",
  FAILED: "bg-[var(--danger-soft)] text-[var(--danger)]",
  SKIPPED: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const lead = await fetchLeadDetail(id, session.clientId!);

  if (!lead) notFound();

  const { customer } = lead;
  const hasUtms        = lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.fbc || lead.fbp;
  const fbclid         = lead.fbc ? lead.fbc.split(".").slice(3).join(".") : null;
  const otherLeads     = customer.leads.filter((l) => l.id !== lead.id);
  const hasSuccessEvent = lead.trackingEvents.some((e) => e.status === "SUCCESS");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/leads" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text)]">{customer.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
              <LeadStatusBadge status={lead.status} />
              <span>•</span>
              <span>Capturada em {new Date(lead.capturedAt).toLocaleDateString("pt-BR")}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DeleteLeadButton leadId={lead.id} hasSale={!!lead.sale} />

          {lead.status === "NEW" ? (
            <>
              <MarkLostButton leadId={lead.id} />
              <RegisterSaleModal leadId={lead.id} customerName={customer.name} />
            </>
          ) : (
            <RegisterLtvSaleModal
              sourceLeadId={lead.id}
              customerName={customer.name}
              hasEmail={!customer.email}
              leadStatus={lead.status}
              previousSalesCount={customer.sales.length}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Dados do contato */}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Dados do contato</h2>
            <div className="flex items-center gap-2">
              <EditLeadModal
                leadId={lead.id}
                notes={lead.notes}
                utmSource={lead.utmSource}
                utmMedium={lead.utmMedium}
                utmCampaign={lead.utmCampaign}
                utmContent={lead.utmContent}
                utmTerm={lead.utmTerm}
              />
              <EditCustomerModal leadId={lead.id} customer={{
                name:      customer.name,
                phone:     customer.phone,
                email:     customer.email,
                document:  customer.document,
                zipCode:   customer.zipCode,
                city:      customer.city,
                state:     customer.state,
                birthDate: customer.birthDate,
              }} />
            </div>
          </div>

          <dl className="space-y-3">
            {[
              { label: "Telefone",   value: customer.phone },
              { label: "Email",      value: customer.email
                  ? <a href={`mailto:${customer.email}`} className="hover:text-[var(--accent)]">{customer.email}</a>
                  : null },
              { label: "CPF / CNPJ", value: customer.document },
              { label: "CEP",        value: customer.zipCode },
              { label: "Cidade",     value: customer.city },
              { label: "Estado",     value: customer.state },
              { label: "Nascimento", value: customer.birthDate
                  ? new Date(customer.birthDate).toLocaleDateString("pt-BR")
                  : null },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-[var(--text-muted)]">{label}</dt>
                <dd className="text-[var(--text)] font-medium">{value}</dd>
              </div>
            ) : null)}
          </dl>

          {lead.notes && (
            <div className="text-sm">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Observações</p>
              <p className="rounded-lg bg-[var(--bg)] p-3 text-xs text-[var(--text)]">{lead.notes}</p>
            </div>
          )}

          {customer.phone && (
            <a
              href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--success)]"
            >
              <ExternalLink size={14} /> Abrir WhatsApp
            </a>
          )}
        </div>

        {/* Venda ou origem da campanha */}
        {lead.sale ? (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)]">Venda registrada</h2>
              <div className="flex items-center gap-2">
                <EditSaleModal
                  saleId={lead.sale.id}
                  defaultValue={Number(lead.sale.value)}
                  defaultNotes={lead.sale.notes}
                  defaultItems={lead.sale.items.map((i) => ({
                    id:       i.id,
                    name:     i.name,
                    quantity: i.quantity,
                    price:    Number(i.price),
                  }))}
                  hasSuccessEvent={hasSuccessEvent}
                />
                <DeleteSaleButton saleId={lead.sale.id} hasSuccessEvent={hasSuccessEvent} />
              </div>
            </div>

            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-[var(--text-muted)]">Valor</dt>
                <dd className="text-base font-semibold text-[var(--success)]">
                  {Number(lead.sale.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-[var(--text-muted)]">Data</dt>
                <dd className="text-[var(--text)]">{new Date(lead.sale.soldAt).toLocaleDateString("pt-BR")}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-[var(--text-muted)]">Recompra</dt>
                <dd className="text-[var(--text)]">{lead.sale.isRepeatPurchase ? "Sim" : "Não"}</dd>
              </div>
              {lead.sale.notes && (
                <div className="text-sm">
                  <dt className="text-[var(--text-muted)] mb-1">Observações</dt>
                  <dd className="text-[var(--text)] bg-[var(--bg)] rounded-lg p-3 text-xs">{lead.sale.notes}</dd>
                </div>
              )}
            </dl>

            {lead.sale.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Itens</p>
                <div className="space-y-1">
                  {lead.sale.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-[var(--text)]">
                      <span>{item.name} × {item.quantity}</span>
                      <span className="text-[var(--text-muted)]">
                        {Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)]">Origem da campanha</h2>
            </div>
            {hasUtms ? (
              <dl className="space-y-3">
                {[
                  { label: "UTM Source",   value: lead.utmSource },
                  { label: "UTM Medium",   value: lead.utmMedium },
                  { label: "UTM Campaign", value: lead.utmCampaign },
                  { label: "UTM Content",  value: lead.utmContent },
                  { label: "UTM Term",     value: lead.utmTerm },
                  { label: "fbclid",       value: fbclid },
                  { label: "fbp",          value: lead.fbp },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex justify-between text-sm">
                    <dt className="text-[var(--text-muted)]">{label}</dt>
                    <dd className="text-[var(--text)] font-medium truncate max-w-[60%]">{value}</dd>
                  </div>
                ) : null)}
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sem dados de UTM para esta lead.</p>
            )}
            {lead.eventSourceUrl && (
              <a
                href={lead.eventSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent flex items-center gap-1 truncate text-xs"
              >
                <ExternalLink size={12} />
                {lead.eventSourceUrl}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Eventos de tracking</h2>
        {lead.trackingEvents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-2">
            {lead.trackingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${trackingStatusColor[event.status]}`}>
                    {trackingStatusLabel[event.status]}
                  </span>
                  <span className="text-[var(--text)] font-medium">{event.eventName}</span>
                </div>
                <div className="flex items-center gap-4 text-[var(--text-muted)]">
                  <span>tentativas: {event.attempts}</span>
                  <span>{new Date(event.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <GuideCard
        title="Como interpretar esta lead"
        description="A tela de detalhe precisa ensinar o operador a decidir a próxima ação sem depender de treinamento externo."
        items={[
          "Se a lead ainda estiver como nova, valide primeiro contato e origem antes de registrar venda ou marcar como perdida.",
          "Se houver falha de tracking, a venda continua válida, mas o evento precisa ser acompanhado no fluxo operacional.",
          "Outras entradas do mesmo cliente final ajudam a identificar recompra, duplicidade operacional ou mudança de origem ao longo do tempo.",
        ]}
        tone="info"
      />

      {lead.statusHistory.length > 1 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Histórico de status</h2>
          <div className="space-y-2">
            {lead.statusHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">
                  {h.from ? `${h.from} → ` : ""}<span className="text-[var(--text)] font-medium">{h.to}</span>
                </span>
                <span className="text-[var(--text-muted)]">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherLeads.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">
            Outras entradas de {customer.name}
          </h2>
          <div className="space-y-2">
            {otherLeads.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <LeadStatusBadge status={l.status} />
                  <span className="text-[var(--text-muted)]">
                    {new Date(l.capturedAt).toLocaleDateString("pt-BR")}
                  </span>
                  {l.sale && (
                    <span className="font-medium text-[var(--success)]">
                      {Number(l.sale.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                </div>
                <Link href={`/leads/${l.id}`} className="link-accent text-xs">
                  Ver lead
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

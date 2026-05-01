import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import { buildTemplateVars, renderTemplate } from "./render";
import { DEFAULT_TEMPLATES } from "./default-templates";
import { Decimal } from "@prisma/client/runtime/library";

const resend = new Resend(process.env.RESEND_API_KEY);

type Threshold = { days: number; templateId: string | null; enabled: boolean };

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function ensureDefaultTemplates() {
  const count = await prisma.emailTemplate.count({ where: { clientId: null, isDefault: true } });
  if (count >= DEFAULT_TEMPLATES.length) return;

  for (const t of DEFAULT_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { id: `default_${t.name.replace(/\s/g, "_").toLowerCase()}` },
      create: { id: `default_${t.name.replace(/\s/g, "_").toLowerCase()}`, ...t, clientId: null },
      update: {},
    });
  }
}

export async function processLtvEmails() {
  await ensureDefaultTemplates();

  const configs = await prisma.ltvEmailConfig.findMany({
    where:   { enabled: true },
    include: { client: true },
  });

  const now = new Date();

  for (const config of configs) {
    const thresholds = config.thresholds as Threshold[];
    const teamInactiveCustomers: Array<{
      customer: { name: string; phone: string; email: string | null };
      days: number;
      lastPurchaseDate: Date;
      lastPurchaseValue: Decimal;
      totalLtv: Decimal;
      totalSales: number;
    }> = [];

    for (const threshold of thresholds) {
      if (!threshold.enabled) continue;

      const targetDate   = subDays(now, threshold.days);
      const windowStart  = startOfDay(targetDate);
      const windowEnd    = endOfDay(targetDate);

      // Clientes cuja última venda foi exatamente nessa janela de dias
      const candidates = await prisma.customer.findMany({
        where: {
          clientId: config.clientId,
          email:    { not: null },
          sales:    { some: { soldAt: { gte: windowStart, lte: windowEnd } } },
        },
        include: {
          sales: { orderBy: { soldAt: "desc" }, take: 1 },
        },
      });

      const eligible = candidates.filter(c => {
        const last = c.sales[0];
        return last && last.soldAt >= windowStart && last.soldAt <= windowEnd;
      });

      for (const customer of eligible) {
        const lastSale = customer.sales[0];

        // Verificar se já enviou esse threshold neste período de inatividade
        const alreadySent = await prisma.ltvEmailLog.findFirst({
          where: {
            clientId:   config.clientId,
            customerId: customer.id,
            threshold:  threshold.days,
            type:       "CUSTOMER",
            sentAt:     { gte: lastSale.soldAt },
          },
        });

        if (alreadySent) continue;

        // Calcular LTV total
        const salesAgg = await prisma.sale.aggregate({
          where:  { clientId: config.clientId, customerId: customer.id },
          _sum:   { value: true },
          _count: { id: true },
        });

        const vars = buildTemplateVars({
          customer,
          lastSale,
          totalSales:            salesAgg._count.id,
          totalLtv:              salesAgg._sum.value ?? new Decimal(0),
          daysSinceLastPurchase: threshold.days,
          clientName:            config.client.name,
        });

        // Buscar template
        const template = threshold.templateId
          ? await prisma.emailTemplate.findUnique({ where: { id: threshold.templateId } })
          : await prisma.emailTemplate.findFirst({ where: { clientId: null, isDefault: true, type: "CUSTOMER", name: { contains: `${threshold.days} dias` } } });

        if (!template) continue;

        const subject = renderTemplate(template.subject, vars);
        const html    = renderTemplate(template.body, vars);

        try {
          const { data } = await resend.emails.send({
            from:    `${config.client.name} via Portal CRM <onboarding@resend.dev>`,
            to:      [customer.email!],
            subject,
            html,
          });

          await prisma.ltvEmailLog.create({
            data: {
              clientId:   config.clientId,
              customerId: customer.id,
              templateId: template.id,
              type:       "CUSTOMER",
              threshold:  threshold.days,
              messageId:  data?.id ?? null,
            },
          });
        } catch (err) {
          console.error(`[LTV Email] Erro ao enviar para ${customer.email}:`, err);
        }

        teamInactiveCustomers.push({
          customer,
          days:              threshold.days,
          lastPurchaseDate:  lastSale.soldAt,
          lastPurchaseValue: lastSale.value,
          totalLtv:          salesAgg._sum.value ?? new Decimal(0),
          totalSales:        salesAgg._count.id,
        });
      }
    }

    // Digest diário para a equipe
    if (config.teamEmails.length > 0 && teamInactiveCustomers.length > 0) {
      await sendTeamDigest({
        clientId:   config.clientId,
        clientName: config.client.name,
        teamEmails: config.teamEmails,
        customers:  teamInactiveCustomers,
      });
    }
  }
}

async function sendTeamDigest(opts: {
  clientId:   string;
  clientName: string;
  teamEmails: string[];
  customers:  Array<{
    customer: { name: string; phone: string; email: string | null };
    days: number;
    lastPurchaseDate: Date;
    lastPurchaseValue: Decimal;
    totalLtv: Decimal;
    totalSales: number;
  }>;
}) {
  const rows = opts.customers
    .sort((a, b) => b.days - a.days)
    .map(({ customer, days, lastPurchaseDate, totalLtv }) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:500;">${customer.name}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${customer.phone}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${customer.email ?? "—"}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">
          <span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:20px;font-size:13px;font-weight:600;">${days}d sem compra</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${lastPurchaseDate.toLocaleDateString("pt-BR")}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:500;">${Number(totalLtv).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:700px;width:100%;">
        <tr>
          <td style="background:#111827;padding:24px 32px;">
            <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${opts.clientName} — Alerta de LTV</h1>
            <p style="color:#9ca3af;margin:4px 0 0;font-size:13px;">${opts.customers.length} cliente(s) precisam de atenção hoje</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Cliente</th>
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Telefone</th>
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Email</th>
                  <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Inatividade</th>
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">Última compra</th>
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">LTV Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">Portal CRM · Digest diário de LTV · ${new Date().toLocaleDateString("pt-BR")}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { data } = await resend.emails.send({
      from:    `Portal CRM <onboarding@resend.dev>`,
      to:      opts.teamEmails,
      subject: `[${opts.clientName}] ${opts.customers.length} cliente(s) sem compra — ${new Date().toLocaleDateString("pt-BR")}`,
      html,
    });

    await prisma.ltvEmailLog.create({
      data: {
        clientId:  opts.clientId,
        type:      "TEAM",
        messageId: data?.id ?? null,
      },
    });
  } catch (err) {
    console.error("[LTV Email] Erro ao enviar digest para equipe:", err);
  }
}

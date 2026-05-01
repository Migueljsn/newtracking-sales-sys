export const DEFAULT_TEMPLATES = [
  {
    name: "Reengajamento — 15 dias",
    subject: "Olá {nome}, sentimos sua falta! 👋",
    type: "CUSTOMER" as const,
    isDefault: true,
    body: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#111827;padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">{empresa}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="color:#111827;margin:0 0 16px;font-size:24px;">Olá, {nome}! 👋</h2>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 16px;">Notamos que já fazem <strong style="color:#111827;">{dias} dias</strong> desde sua última compra conosco — e sentimos sua falta!</p>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 32px;">Temos novidades esperando por você. Que tal dar uma olhada no que preparamos especialmente para clientes como você?</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="#" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Ver novidades exclusivas</a>
              </td></tr>
            </table>
            <p style="color:#9ca3af;font-size:13px;margin:32px 0 0;text-align:center;">Sua última compra foi em <strong>{data_ultima_compra}</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">{empresa} · Enviado via Portal CRM</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    name: "Reengajamento — 20 dias",
    subject: "{nome}, preparamos uma oferta exclusiva para você 🎁",
    type: "CUSTOMER" as const,
    isDefault: true,
    body: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#111827;padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">{empresa}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <table cellpadding="0" cellspacing="0" width="100%" style="background:#fef9c3;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;text-align:center;">
                <p style="color:#854d0e;font-weight:700;margin:0;font-size:15px;">🎁 Oferta especial preparada para você</p>
              </td></tr>
            </table>
            <h2 style="color:#111827;margin:0 0 16px;font-size:24px;">Que saudade, {nome}!</h2>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 16px;">Já se passaram <strong style="color:#111827;">{dias} dias</strong> desde sua última compra e queremos te trazer de volta com uma condição especial.</p>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 32px;">Reabastece seu estoque agora e aproveite as condições exclusivas que preparamos para clientes fiéis como você.</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="#" style="display:inline-block;background:#d97706;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Garantir oferta exclusiva</a>
              </td></tr>
            </table>
            <p style="color:#9ca3af;font-size:13px;margin:32px 0 0;text-align:center;">Última compra: <strong>{data_ultima_compra}</strong> · Total investido: <strong>{valor_total_ltv}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">{empresa} · Enviado via Portal CRM</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  {
    name: "Reengajamento — 30 dias",
    subject: "⚠️ {nome}, não perca esta última oportunidade",
    type: "CUSTOMER" as const,
    isDefault: true,
    body: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#991b1b;padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">{empresa}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <h2 style="color:#991b1b;margin:0 0 16px;font-size:24px;">⚠️ {nome}, não perca isso</h2>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 16px;">Faz <strong style="color:#111827;">{dias} dias</strong> que você não compra conosco. Não queremos te perder como cliente!</p>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 16px;">Você já fez <strong style="color:#111827;">{total_compras} compra(s)</strong> e investiu <strong style="color:#111827;">{valor_total_ltv}</strong> conosco. Isso nos importa muito.</p>
            <p style="color:#6b7280;line-height:1.7;margin:0 0 32px;">Preparamos nossa melhor condição especialmente para você voltar. Esta oferta é por tempo limitado.</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="#" style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Quero aproveitar agora</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">{empresa} · Enviado via Portal CRM</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
];

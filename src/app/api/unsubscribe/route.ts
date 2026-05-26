import { NextRequest, NextResponse } from "next/server";
import { prisma }            from "@/lib/db/prisma";
import { verifyUnsubToken }  from "@/lib/email/unsubscribe";

async function processUnsub(token: string | null): Promise<{ ok: boolean; alreadyDone?: boolean }> {
  if (!token) return { ok: false };

  const payload = verifyUnsubToken(token);
  if (!payload) return { ok: false };

  const customer = await prisma.customer.findUnique({
    where:  { id: payload.customerId },
    select: { emailOptOut: true, clientId: true },
  });

  if (!customer || customer.clientId !== payload.clientId) return { ok: false };
  if (customer.emailOptOut) return { ok: true, alreadyDone: true };

  await prisma.customer.update({
    where: { id: payload.customerId },
    data:  { emailOptOut: true },
  });

  return { ok: true };
}

// ── One-click unsubscribe (email clients) e confirmação via form do browser ──
export async function POST(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get("token");
  const result = await processUnsub(token);

  if (!result.ok) return new NextResponse("Link inválido", { status: 400 });

  // Verifica se veio de um browser (form submit) ou de um email client
  const accept = req.headers.get("accept") ?? "";
  const isHtml = accept.includes("text/html");

  if (isHtml) {
    // Redireciona o browser para a página de confirmação
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.redirect(`${base}/api/unsubscribe?done=1`, { status: 303 });
  }

  return new NextResponse("OK", { status: 200 });
}

// ── Página de confirmação (usuário clicou no link do e-mail) ───────────────
export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get("token");
  const done   = req.nextUrl.searchParams.get("done") === "1";

  if (done) {
    return new NextResponse(confirmPage(true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const payload = token ? verifyUnsubToken(token) : null;
  if (!payload) {
    return new NextResponse(errorPage(), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(confirmPage(false, token!), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── Processa confirmação via form POST ─────────────────────────────────────
// (quando o usuário clica no botão da página de confirmação)
// Next.js roteia POST sem token para o handler acima, então usamos GET com ?done=1
// depois de processar via fetch interno.
// Alternativa limpa: usar action no form apontando para mesma rota com ?token=xxx
// → aproveitamos o POST handler acima, depois redirecionamos para ?done=1

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Descadastro de e-mails</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f4f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #111827; margin-bottom: 8px; font-weight: 700; }
    p  { font-size: 14px; color: #6b7280; line-height: 1.6; }
    .btn {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      text-decoration: none;
    }
    .btn-danger  { background: #dc2626; color: #fff; }
    .btn-muted   { background: #f3f4f6; color: #374151; margin-left: 8px; }
    form { margin-top: 24px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  </style>
</head>
<body><div class="card">${content}</div></body>
</html>`;
}

function confirmPage(success: boolean, token?: string): string {
  if (success) {
    return shell(`
      <div class="icon">✅</div>
      <h1>Descadastro realizado</h1>
      <p>Você não receberá mais e-mails de reengajamento.<br>Se mudar de ideia, entre em contato conosco.</p>
    `);
  }

  return shell(`
    <div class="icon">📧</div>
    <h1>Cancelar recebimento de e-mails</h1>
    <p>Confirme abaixo para parar de receber nossas comunicações por e-mail.</p>
    <form method="POST" action="/api/unsubscribe?token=${token}">
      <button type="submit" class="btn btn-danger">Confirmar descadastro</button>
      <a href="/" class="btn btn-muted">Cancelar</a>
    </form>
  `);
}

function errorPage(): string {
  return shell(`
    <div class="icon">⚠️</div>
    <h1>Link inválido</h1>
    <p>Este link de descadastro é inválido ou expirou.<br>Entre em contato conosco caso precise de ajuda.</p>
  `);
}

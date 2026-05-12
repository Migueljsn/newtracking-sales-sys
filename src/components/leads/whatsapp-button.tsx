"use client";

import { MessageCircle } from "lucide-react";

const DEFAULT_TEMPLATE =
  "Olá {nome}! Aqui é da equipe do {estado}. Vi que você demonstrou interesse nos nossos produtos e tenho uma condição especial disponível por tempo limitado. Posso te passar os detalhes agora?";

interface Props {
  phone:      string;
  name:       string;
  state?:     string | null;
  city?:      string | null;
  template?:  string | null;
  variant?:   "full" | "icon";
}

function buildMessage(template: string, name: string, state?: string | null, city?: string | null) {
  return template
    .replace(/\{nome\}/g,   name)
    .replace(/\{estado\}/g, state ?? "")
    .replace(/\{cidade\}/g, city  ?? "");
}

export function WhatsAppButton({ phone, name, state, city, template, variant = "full" }: Props) {
  const digits  = phone.replace(/\D/g, "");
  const message = buildMessage(template ?? DEFAULT_TEMPLATE, name, state, city);
  const href    = `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;

  if (variant === "icon") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Enviar mensagem no WhatsApp"
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)] transition-colors hover:bg-[var(--success)] hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle size={15} />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--success)] hover:text-[var(--success)]/80 transition-colors"
    >
      <MessageCircle size={15} />
      Enviar mensagem no WhatsApp
    </a>
  );
}

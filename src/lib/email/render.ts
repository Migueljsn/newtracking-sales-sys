import { Decimal } from "@prisma/client/runtime/library";

interface TemplateVars {
  nome:              string;
  nome_completo:     string;
  telefone:          string;
  email:             string;
  dias:              number;
  data_ultima_compra: string;
  valor_ultima_compra: string;
  total_compras:     number;
  valor_total_ltv:   string;
  empresa:           string;
}

function formatCurrency(value: Decimal | number): string {
  const n = typeof value === "number" ? value : Number(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export function buildTemplateVars(opts: {
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  lastSale: {
    soldAt: Date;
    value: Decimal;
  };
  totalSales: number;
  totalLtv: Decimal;
  daysSinceLastPurchase: number;
  clientName: string;
}): TemplateVars {
  const firstName = opts.customer.name.split(" ")[0];

  return {
    nome:               firstName,
    nome_completo:      opts.customer.name,
    telefone:           opts.customer.phone,
    email:              opts.customer.email ?? "",
    dias:               opts.daysSinceLastPurchase,
    data_ultima_compra: formatDate(opts.lastSale.soldAt),
    valor_ultima_compra: formatCurrency(opts.lastSale.value),
    total_compras:      opts.totalSales,
    valor_total_ltv:    formatCurrency(opts.totalLtv),
    empresa:            opts.clientName,
  };
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key as keyof TemplateVars];
    return value !== undefined ? String(value) : match;
  });
}

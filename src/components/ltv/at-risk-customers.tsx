import Link from "next/link";
import { AlertTriangle, Mail, MailCheck } from "lucide-react";

interface CustomerRow {
  id: string;
  leadId: string | null;
  name: string;
  phone: string;
  email: string | null;
  lastSaleAt: Date;
  daysSinceLast: number;
  sentThresholds: number[];
}

interface Threshold {
  days: number;
  enabled: boolean;
}

interface Props {
  customers: CustomerRow[];
  thresholds: Threshold[];
}

function riskColor(days: number, thresholds: number[]) {
  const sorted = [...thresholds].sort((a, b) => b - a);
  if (days >= (sorted[0] ?? 30)) return "text-[var(--danger)] bg-[var(--danger-soft)]";
  if (days >= (sorted[1] ?? 20)) return "text-[var(--warning)] bg-[var(--warning-soft)]";
  return "text-[var(--accent)] bg-[var(--accent-soft)]";
}

export function AtRiskCustomers({ customers, thresholds }: Props) {
  const enabledDays = thresholds.filter((t) => t.enabled).map((t) => t.days);

  if (customers.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-[var(--warning)]" />
          <h2 className="text-sm font-semibold text-[var(--text)]">Clientes em risco</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] text-center py-6">
          Nenhum cliente atingiu os thresholds configurados.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-[var(--warning)]" />
        <h2 className="text-sm font-semibold text-[var(--text)]">Clientes em risco</h2>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {customers.length} cliente{customers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr className="border-b border-[var(--border)]">
                {["Cliente", "Contato", "Última compra", "Inatividade", "Email enviado", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--text)]">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    <div>{c.phone}</div>
                    {c.email && <div className="truncate max-w-[200px]">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {new Date(c.lastSaleAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${riskColor(c.daysSinceLast, enabledDays)}`}>
                      {c.daysSinceLast}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.sentThresholds.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MailCheck size={13} className="text-[var(--success)] shrink-0" />
                        <span className="text-xs text-[var(--success)]">
                          {c.sentThresholds.map((d) => `${d}d`).join(", ")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} className="text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">Não enviado</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.leadId && (
                      <Link href={`/leads/${c.leadId}`} className="link-accent text-xs">
                        Ver lead →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

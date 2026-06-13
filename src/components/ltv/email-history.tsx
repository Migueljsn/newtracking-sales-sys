import Link from "next/link";

interface LogRow {
  id: string;
  type: "CUSTOMER" | "TEAM";
  threshold: number | null;
  sentAt: Date;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  customer: { id: string; name: string; leadId: string | null } | null;
  template: { name: string } | null;
}

interface Props {
  logs: LogRow[];
}

function StatusBadge({ log }: { log: LogRow }) {
  if (log.bouncedAt)
    return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[var(--danger-soft)] text-[var(--danger)]">Bounce</span>;
  if (log.clickedAt)
    return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[var(--success-soft)] text-[var(--success)]">Clicado</span>;
  if (log.openedAt)
    return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)]">Aberto</span>;
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[var(--surface-muted)] text-[var(--text-muted)]">Enviado</span>;
}

export function EmailHistory({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Histórico de disparos</h2>
        <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum email disparado ainda.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text)]">Histórico de disparos</h2>
        <span className="text-xs text-[var(--text-muted)]">{logs.length} registro{logs.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr className="border-b border-[var(--border)]">
                {["Destinatário", "Template", "Threshold", "Data", "Status"].map((h) => (
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
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-3">
                    {log.type === "TEAM" ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                        Equipe
                      </span>
                    ) : log.customer ? (
                      log.customer.leadId ? (
                        <Link
                          href={`/leads/${log.customer.leadId}`}
                          className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                        >
                          {log.customer.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--text)]">{log.customer.name}</span>
                      )
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {log.template?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {log.threshold ? `${log.threshold} dias` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {new Date(log.sentAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge log={log} />
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

export const dynamic = "force-dynamic";

import { ImportUploader } from "@/components/import/import-uploader";
import { GuideCard } from "@/components/ui/guide-card";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Importar leads</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Importe leads em massa via planilha XLSX. Leads com status VENDA já registram o evento Purchase automaticamente.
        </p>
      </div>

      <div className="card max-w-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">Formato esperado da planilha</h2>
        <div className="space-y-1.5 text-sm text-[var(--text-muted)]">
          <p>• Colunas obrigatórias: <strong className="text-[var(--text)]">Nome</strong>, <strong className="text-[var(--text)]">Telefone</strong></p>
          <p>• Status aceitos: <strong className="text-[var(--text)]">NOVA</strong>, <strong className="text-[var(--text)]">CADASTRADA</strong>, <strong className="text-[var(--text)]">VENDA</strong>, <strong className="text-[var(--text)]">PERDIDA</strong></p>
          <p>• Se Status = VENDA, a coluna <strong className="text-[var(--text)]">Valor da Venda (R$)</strong> é obrigatória</p>
          <p>• Datas no formato <strong className="text-[var(--text)]">DD/MM/AAAA</strong></p>
          <p>• Leads duplicadas (mesmo telefone ativo) são ignoradas automaticamente</p>
        </div>
        <p className="text-xs text-[var(--text-muted)] pt-1">
          Use <strong className="text-[var(--text)]">Baixar modelo</strong> para obter a planilha com todas as colunas corretas e uma linha de exemplo.
        </p>
      </div>

      <GuideCard
        title="Boas práticas de importação"
        description="Importação é o ponto em que mais entra dado incompleto. Vale orientar o operador aqui em vez de esperar erro comercial."
        items={[
          "Sempre baixe o modelo antes de montar a planilha — garante colunas, nomes e ordem compatíveis com o sistema.",
          "Preencha Email, CPF/CNPJ e CEP sempre que possível: esses dados aumentam a precisão do rastreamento no Meta.",
          "Se a origem da campanha for importante para tracking, preencha UTMs no arquivo antes de importar.",
          "Leads duplicadas são ignoradas; se uma linha não entrou, revise o telefone antes de tentar novamente.",
        ]}
        tone="warning"
      />

      <ImportUploader />
    </div>
  );
}

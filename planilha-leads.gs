/**
 * Fonil Sales System — Configurador de Planilha de Leads
 *
 * Como usar:
 * 1. Abra o Google Sheets (planilha nova ou existente)
 * 2. Vá em Extensões > Apps Script
 * 3. Cole este código inteiro
 * 4. Clique em "Executar" com a função "configurarPlanilha" selecionada
 * 5. Autorize as permissões quando solicitado
 */

function configurarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 1. Aba Leads ──────────────────────────────────────────────────────────
  let aba = ss.getSheetByName("Leads");
  if (!aba) {
    aba = ss.insertSheet("Leads");
  } else {
    aba.clear();
  }

  // Remove abas padrão desnecessárias
  const abasPadrao = ["Plan1", "Sheet1", "Página1"];
  abasPadrao.forEach(nome => {
    const a = ss.getSheetByName(nome);
    if (a && ss.getSheets().length > 1) ss.deleteSheet(a);
  });

  // ── 2. Cabeçalhos ─────────────────────────────────────────────────────────
  const cabecalhos = [
    "Nome",
    "Telefone",
    "Email",
    "CPF/CNPJ",
    "CEP",
    "Cidade",
    "Estado",
    "Data de Nascimento",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "UTM Content",
    "UTM Term",
    "Status",
    "Valor da Venda (R$)",
    "Data da Venda",
    "Data de Captura",
    "ID da Lead",          // preenchido pelo sistema
    "Evento Lead (Meta)",  // SUCCESS / FAILED / PENDING
    "Evento Purchase (Meta)" // SUCCESS / FAILED / PENDING / —
  ];

  aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);

  // ── 3. Estilo do cabeçalho ────────────────────────────────────────────────
  const rangeHeader = aba.getRange(1, 1, 1, cabecalhos.length);
  rangeHeader
    .setBackground("#1a1a2e")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  aba.setFrozenRows(1);
  aba.setRowHeight(1, 36);

  // ── 4. Larguras das colunas ───────────────────────────────────────────────
  const larguras = [
    200, // Nome
    140, // Telefone
    200, // Email
    130, // CPF/CNPJ
    90,  // CEP
    130, // Cidade
    70,  // Estado
    130, // Data de Nascimento
    120, // UTM Source
    120, // UTM Medium
    160, // UTM Campaign
    140, // UTM Content
    120, // UTM Term
    90,  // Status
    140, // Valor da Venda
    120, // Data da Venda
    130, // Data de Captura
    160, // ID da Lead
    150, // Evento Lead
    160, // Evento Purchase
  ];

  larguras.forEach((largura, i) => {
    aba.setColumnWidth(i + 1, largura);
  });

  // ── 5. Validação: coluna Status (col 14) ──────────────────────────────────
  const regraStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(["NOVA", "VENDA", "PERDIDA"], true)
    .setAllowInvalid(false)
    .setHelpText("Selecione: NOVA, VENDA ou PERDIDA")
    .build();

  aba.getRange(2, 14, 999).setDataValidation(regraStatus);

  // ── 6. Validação: coluna Estado (col 7) ───────────────────────────────────
  const estados = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
                   "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
                   "RS","RO","RR","SC","SP","SE","TO"];

  const regraEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(estados, true)
    .setAllowInvalid(true)
    .build();

  aba.getRange(2, 7, 999).setDataValidation(regraEstado);

  // ── 7. Validação: colunas de tracking (cols 19 e 20) ─────────────────────
  const regraTracking = SpreadsheetApp.newDataValidation()
    .requireValueInList(["PENDING", "SUCCESS", "FAILED", "SKIPPED", "—"], true)
    .setAllowInvalid(true)
    .build();

  aba.getRange(2, 19, 999).setDataValidation(regraTracking);
  aba.getRange(2, 20, 999).setDataValidation(regraTracking);

  // ── 8. Formato das colunas de data ────────────────────────────────────────
  aba.getRange(2, 8, 999).setNumberFormat("dd/mm/yyyy");   // Nascimento
  aba.getRange(2, 16, 999).setNumberFormat("dd/mm/yyyy");  // Data Venda
  aba.getRange(2, 17, 999).setNumberFormat("dd/mm/yyyy hh:mm"); // Captura

  // ── 9. Formato moeda na coluna Valor ─────────────────────────────────────
  aba.getRange(2, 15, 999).setNumberFormat("R$ #,##0.00");

  // ── 10. Formatação condicional por Status ─────────────────────────────────
  const regras = [];

  // VENDA → fundo verde claro
  regras.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("VENDA")
      .setBackground("#d4edda")
      .setFontColor("#155724")
      .setRanges([aba.getRange(2, 1, 999, cabecalhos.length)])
      .build()
  );

  // PERDIDA → fundo vermelho claro
  regras.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("PERDIDA")
      .setBackground("#f8d7da")
      .setFontColor("#721c24")
      .setRanges([aba.getRange(2, 1, 999, cabecalhos.length)])
      .build()
  );

  // NOVA → fundo azul claro
  regras.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("NOVA")
      .setBackground("#e8f4fd")
      .setFontColor("#0c5460")
      .setRanges([aba.getRange(2, 1, 999, cabecalhos.length)])
      .build()
  );

  aba.setConditionalFormatRules(regras);

  // ── 11. Linha alternada nas linhas de dados ───────────────────────────────
  // Cor base para linhas pares (suave, não sobrepõe formatação condicional)
  // Deixamos sem banding para não conflitar com as cores condicionais de status

  // ── 12. Proteger cabeçalho ────────────────────────────────────────────────
  const protecao = aba.getRange(1, 1, 1, cabecalhos.length).protect();
  protecao.setDescription("Cabeçalho — não editar");
  protecao.setWarningOnly(true);

  // ── 13. Fixar as colunas principais à esquerda ────────────────────────────
  aba.setFrozenColumns(2); // Nome e Telefone sempre visíveis ao rolar

  // ── 14. Renomear planilha ─────────────────────────────────────────────────
  ss.rename("Fonil Sales System — Leads");

  // ── 15. Mensagem final ────────────────────────────────────────────────────
  SpreadsheetApp.getUi().alert(
    "✅ Planilha configurada com sucesso!\n\n" +
    "• " + cabecalhos.length + " colunas padronizadas\n" +
    "• Validação de Status: NOVA / VENDA / PERDIDA\n" +
    "• Validação de Estado: siglas brasileiras\n" +
    "• Formatação condicional por status\n" +
    "• Cabeçalho e colunas Nome/Telefone fixados\n\n" +
    "A planilha está pronta para receber dados do sistema."
  );
}


/**
 * Função auxiliar: insere uma linha de lead manualmente para teste.
 * Útil para validar se o formato está correto antes de conectar a API.
 */
function inserirLeadDeTeste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Leads");

  if (!aba) {
    SpreadsheetApp.getUi().alert("Aba 'Leads' não encontrada. Execute configurarPlanilha() primeiro.");
    return;
  }

  const hoje = new Date();
  const dadosTeste = [
    "João da Silva",
    "11999998888",
    "joao@email.com",
    "123.456.789-00",
    "01310-100",
    "São Paulo",
    "SP",
    new Date("1990-05-15"),
    "facebook",
    "cpc",
    "campanha-teste-abril",
    "criativo-01",
    "",
    "NOVA",
    "",
    "",
    hoje,
    "lead_teste_001",
    "PENDING",
    "—"
  ];

  aba.appendRow(dadosTeste);
  SpreadsheetApp.getUi().alert("Lead de teste inserida na última linha.");
}

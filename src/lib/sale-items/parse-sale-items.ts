// Linguagem para colar itens de venda extraídos por IA (ex: de um PDF de
// pedido de distribuidora). Uma linha por produto:
//
//   - 10x Coca-Cola 2L | 6,50
//
// "-" opcional, quantidade + "x" + nome, "|" separa o preço unitário.
// Linhas começando com "//" são comentários. Linhas que não batem no
// padrão viram erro (não interrompem o parse do restante).

export interface ParsedSaleItem {
  name:     string;
  quantity: number;
  price:    number;
}

export interface ParseSaleItemsError {
  line: number;
  raw:  string;
}

export interface ParseSaleItemsResult {
  items:  ParsedSaleItem[];
  errors: ParseSaleItemsError[];
  total:  number;
}

const LINE_RE = /^-?\s*(\d+)\s*[x×]\s+(.+?)\s*\|\s*(?:r\$\s*)?([\d.,]+)\s*$/i;

function parsePrice(raw: string): number {
  const hasComma = raw.includes(",");
  const hasDot   = raw.includes(".");
  let normalized = raw;
  if (hasComma && hasDot) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = raw.replace(",", ".");
  }
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
}

export function parseSaleItemsText(text: string): ParseSaleItemsResult {
  const items:  ParsedSaleItem[]      = [];
  const errors: ParseSaleItemsError[] = [];

  text.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) return;

    const match = line.match(LINE_RE);
    if (!match) {
      errors.push({ line: idx + 1, raw: rawLine });
      return;
    }

    const quantity = parseInt(match[1], 10);
    const name     = match[2].trim();
    const price    = parsePrice(match[3]);

    if (!name || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ line: idx + 1, raw: rawLine });
      return;
    }

    items.push({ name, quantity, price });
  });

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return { items, errors, total };
}

export const SALE_ITEMS_AI_PROMPT = `Leia o PDF do pedido de compra anexado (feito a uma distribuidora) e extraia cada produto comprado.

Devolva SOMENTE no formato abaixo, uma linha por produto, sem nenhum texto antes ou depois:

- <quantidade>x <nome do produto> | <preço unitário em reais, use vírgula>

Regras:
- Não calcule o total da compra, apenas quantidade e preço unitário de cada item.
- Não invente produtos que não estejam no pedido.
- Se não conseguir ler algum campo com certeza, pule a linha e adicione um comentário começando com // explicando o motivo.

Exemplo de saída:
- 10x Coca-Cola 2L | 6,50
- 5x Guaraná Antarctica 2L | 5,90
- 3x Fanta Laranja 2L | 5,90`;

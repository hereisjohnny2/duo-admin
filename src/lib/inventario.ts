import type { InventarioItem, InventarioStatus } from "./types";

/* =====================================================================
   Funções puras do módulo Inventário — compartilhadas por cliente e servidor.
   NÃO importar nada de node aqui (este módulo roda no browser).
   ===================================================================== */

/** Cada categoria define o prefixo do código dos seus itens (ex.: HID-007). */
export const CAT_PREFIX: Record<string, string> = {
  Acabamento: "ACB",
  Concreto: "CCR",
  Construção: "CON",
  Elétrica: "ELE",
  EPI: "EPI",
  Estrutura: "EST",
  Ferragem: "FRG",
  Ferramenta: "FRM",
  Fixação: "FIX",
  Hidráulica: "HID",
  Parafuso: "PAR",
  Pintura: "PIN",
  Uniforme: "UNI",
};

export const CATEGORIAS = Object.keys(CAT_PREFIX).sort((a, b) => a.localeCompare(b, "pt"));

export const UNIDADES = ["un", "cx", "par", "pct", "rol", "pcs", "m", "kg", "L", "sc"];

export const STATUSES: InventarioStatus[] = ["OK", "REPOR", "ZERADO"];

/** Cores de cada status (fundo/texto) para badges e chips. */
export const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  OK: { bg: "#dcfce7", fg: "#15803d" },
  REPOR: { bg: "#fef3c7", fg: "#b45309" },
  ZERADO: { bg: "#fee2e2", fg: "#b91c1c" },
};

/** Zerado quando não há saldo; a repor quando o saldo bateu no estoque mínimo. */
export function statusOf(item: Pick<InventarioItem, "quantidade" | "estoqueMinimo">): InventarioStatus {
  const q = Number(item.quantidade) || 0;
  const min = Number(item.estoqueMinimo) || 0;
  if (q <= 0) return "ZERADO";
  if (q <= min) return "REPOR";
  return "OK";
}

/** Quantidades usam vírgula decimal e no máximo 2 casas (ex.: 8,5). */
export function fmtQtd(n: number): string {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Arredonda em 2 casas e nunca deixa o saldo ficar negativo. */
export function clampQtd(n: number): number {
  return Math.max(0, Math.round((Number(n) || 0) * 100) / 100);
}

/** Próximo código livre da categoria, a partir dos códigos já usados nela. */
export function nextCodigo(categoria: string, codigosExistentes: string[]): string {
  const prefix = CAT_PREFIX[categoria];
  if (!prefix) throw new Error(`Categoria desconhecida: ${categoria}`);

  const usados = codigosExistentes
    .filter((c) => c.startsWith(`${prefix}-`))
    .map((c) => parseInt(c.slice(prefix.length + 1), 10))
    .filter((n) => Number.isFinite(n));

  const proximo = (usados.length ? Math.max(...usados) : 0) + 1;
  return `${prefix}-${String(proximo).padStart(3, "0")}`;
}

export interface InventarioSummary {
  total: number;
  ok: number;
  repor: number;
  zerado: number;
  byCategoria: { name: string; n: number }[];
}

export function summarize(items: InventarioItem[]): InventarioSummary {
  const byCategoria = new Map<string, number>();
  let ok = 0;
  let repor = 0;
  let zerado = 0;

  for (const item of items) {
    const s = statusOf(item);
    if (s === "OK") ok++;
    else if (s === "REPOR") repor++;
    else zerado++;
    byCategoria.set(item.categoria, (byCategoria.get(item.categoria) ?? 0) + 1);
  }

  return {
    total: items.length,
    ok,
    repor,
    zerado,
    byCategoria: [...byCategoria.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
  };
}

/** Gera o CSV (separado por ";", com BOM) usado pelo botão Exportar. */
export function toCSV(items: InventarioItem[]): string {
  const head = ["Código", "Produto", "Categoria", "Qtd", "Unidade", "Estoque Mín", "Status", "Localização", "Observações"];
  const rows = items.map((i) => [i.codigo, i.produto, i.categoria, fmtQtd(i.quantidade), i.unidade, fmtQtd(i.estoqueMinimo), statusOf(i), i.localizacao, i.observacoes]);
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [head, ...rows].map((r) => r.map((v) => esc(String(v ?? ""))).join(";")).join("\r\n");
}

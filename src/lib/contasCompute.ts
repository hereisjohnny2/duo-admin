import { parseBRL, fmt } from "./compute";
import type { Conta, ContaStatus } from "./types";

/* =====================================================================
   Funções puras do módulo Contas — compartilhadas por cliente e servidor.
   ===================================================================== */

export const CONTA_STATUSES: ContaStatus[] = ["Em Aberto", "Pago", "Atrasado"];

export const CONTA_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Em Aberto": { bg: "#dbeafe", fg: "#1d4ed8" },
  Pago: { bg: "#dcfce7", fg: "#15803d" },
  Atrasado: { bg: "#fee2e2", fg: "#b91c1c" },
};

export { fmt, parseBRL };

/** yyyy-mm-dd -> dd/mm/yyyy (ou "—" se vazio/inválido). */
export function formatDate(iso: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** yyyy-mm-dd -> yyyy-mm (mês de referência para agrupar/filtrar). */
export function mesDeVencimento(vencimento: string): string {
  return String(vencimento ?? "").slice(0, 7);
}

export function mesLabel(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mes;
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const idx = parseInt(m[2], 10) - 1;
  return `${nomes[idx] ?? m[2]} ${m[1]}`;
}

export interface ContaSummary {
  totalSaida: number;
  nContas: number;
  emAberto: number;
  atrasado: number;
}

export function summarizeContas(list: Conta[]): ContaSummary {
  let totalSaida = 0;
  let emAberto = 0;
  let atrasado = 0;
  for (const c of list) {
    totalSaida += parseBRL(c.saida) ?? 0;
    if (c.status === "Em Aberto") emAberto++;
    if (c.status === "Atrasado") atrasado++;
  }
  return {
    totalSaida,
    nContas: list.length,
    emAberto,
    atrasado,
  };
}

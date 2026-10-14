import { parseBRL, fmt } from "./compute";
import type { Conta, ContaArquivoTipo, ContaStatus } from "./types";

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

/* ---- Arquivos (boleto/comprovante) ---- */

export const CONTA_ARQUIVO_TIPOS: ContaArquivoTipo[] = ["boleto", "comprovante"];

export const CONTA_ARQUIVO_LABEL: Record<ContaArquivoTipo, string> = {
  boleto: "Boleto",
  comprovante: "Comprovante",
};

/** O proxy de autenticação só repassa corpos de até 10 MB; o limite fica abaixo disso (igual ao do bucket). */
export const CONTA_ARQUIVO_MAX_BYTES = 8 * 1024 * 1024;

export const CONTA_ARQUIVO_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/** Valor do atributo `accept` do <input type="file">. */
export const CONTA_ARQUIVO_ACCEPT = CONTA_ARQUIVO_TYPES.join(",");

export function isContaArquivoTipo(v: string): v is ContaArquivoTipo {
  return (CONTA_ARQUIVO_TIPOS as string[]).includes(v);
}

/** Mensagem de erro para um arquivo que não pode ser enviado, ou null se ele é aceito. */
export function validateContaArquivo(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > CONTA_ARQUIVO_MAX_BYTES) return "O arquivo passa de 8 MB.";
  if (!CONTA_ARQUIVO_TYPES.includes(file.type)) return "Envie um PDF ou uma imagem (PNG, JPG ou WEBP).";
  return null;
}

/** URL que abre o arquivo (a API busca no Storage). */
export function contaArquivoUrl(contaId: string, tipo: ContaArquivoTipo): string {
  return `/api/contas/${contaId}/arquivos/${tipo}`;
}

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

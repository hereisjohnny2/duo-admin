import { parseBRL, fmt } from "./compute";
import type { Conta, ContaArquivoTipo, ContaStatus } from "./types";

/* =====================================================================
   Funções puras do módulo Contas — compartilhadas por cliente e servidor.
   ===================================================================== */

export const CONTA_STATUSES: ContaStatus[] = ["Em Aberto", "Pago", "Atrasado"];

export const CONTA_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Em Aberto": { bg: "#e6e6e6", fg: "#333333" },
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

/** O proxy de autenticação só repassa corpos de até 10 MB; o limite de cada parte fica abaixo disso. */
export const CONTA_ARQUIVO_MAX_BYTES = 8 * 1024 * 1024;

/** Imagens viram uma página do PDF da conta (o pdf-lib só embute PNG e JPG). */
export const CONTA_ARQUIVO_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Valor do atributo `accept` do <input type="file">. */
export const CONTA_ARQUIVO_ACCEPT = CONTA_ARQUIVO_TYPES.join(",");

export function isContaArquivoTipo(v: string): v is ContaArquivoTipo {
  return (CONTA_ARQUIVO_TIPOS as string[]).includes(v);
}

/** Mensagem de erro para um arquivo que não pode ser enviado, ou null se ele é aceito. */
export function validateContaArquivo(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > CONTA_ARQUIVO_MAX_BYTES) return "O arquivo passa de 8 MB.";
  if (!CONTA_ARQUIVO_TYPES.includes(file.type)) return "Envie um PDF ou uma imagem (PNG ou JPG).";
  return null;
}

/* ---- Nome do PDF da conta ---- */

/** Sem acentos e só com letras, números e hífen (o Storage não aceita outros caracteres no nome). */
function slug(valor: string): string {
  return valor
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * <Prefixo>_<Categoria>_<Beneficiario>+<Identificacao>_<Mes>_<Ano>.pdf, com mês e ano do vencimento.
 * BOL = boleto sozinho ou boleto + comprovante juntos; COMP = comprovante sozinho.
 * Sem identificação, o "+<Identificacao>" é omitido. Devolve null se não há vencimento válido.
 */
export function nomePdfConta(
  conta: { categoria: string; beneficiario: string; identificacao: string; vencimento: string },
  prefixo: "BOL" | "COMP" = "BOL"
): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(conta.vencimento ?? "");
  if (!m) return null;
  const [, ano, mes] = m;
  const beneficiario = [slug(conta.beneficiario), slug(conta.identificacao)].filter(Boolean).join("+");
  return `${prefixo}_${slug(conta.categoria)}_${beneficiario}_${mes}_${ano}.pdf`;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Nome da pasta do mês no Storage, ordenável e sem acento (o Storage não aceita): "03 - Marco". */
export function nomePastaMes(mes: string): string {
  return `${mes} - ${MESES[Number(mes) - 1] ?? mes}`.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** [ano, mês] das pastas de um vencimento yyyy-mm-dd, ou null se ele não é válido. */
export function pastasAnoMes(vencimento: string): [string, string] | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(vencimento ?? "");
  return m ? [m[1], nomePastaMes(m[2])] : null;
}

/** Prefixo do arquivo próprio de cada parte. */
export const CONTA_ARQUIVO_PREFIXO: Record<ContaArquivoTipo, "BOL" | "COMP"> = {
  boleto: "BOL",
  comprovante: "COMP",
};

/** URL que abre o PDF único da conta (a API busca no Storage). */
export function contaPdfUrl(contaId: string): string {
  return `/api/contas/${contaId}/arquivos`;
}

/** URL que abre (GET), envia (PUT) ou remove (DELETE) uma parte; o GET abre o arquivo próprio dela. */
export function contaParteUrl(contaId: string, tipo: ContaArquivoTipo): string {
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

import { fmt, normalizeMoney, parseBRL } from "./compute";
import { mesDeVencimento } from "./contasCompute";
import { lerXlsx, serialParaIso, type XlsxCelula } from "./xlsx";
import type { ContaInput, ContaStatus } from "./types";

/* =====================================================================
   "Importar da planilha" — lê o modelo CTR03.R00_FINANCEIRO_<ano>.xlsx:
   uma aba por mês (JAN, FEV, ...), com o cabeçalho CATEGORIA |
   BENEFICIÁRIO | IDENTIFICAÇÃO | VENCIMENTO | DATA DE DÉBITO | SAÍDAS |
   ENTRADAS | STATUS | OBSERVAÇÕES e uma conta por linha abaixo dele.
   Abas sem esse cabeçalho (ex.: TABELAS) são ignoradas.
   Funções puras, compartilhadas por cliente (prévia) e servidor.
   ===================================================================== */

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const STATUS: Record<string, ContaStatus> = {
  PAGO: "Pago",
  "EM ABERTO": "Em Aberto",
  ATRASADO: "Atrasado",
};

/** Coluna do cabeçalho (normalizado) -> campo da conta. */
const COLUNAS: Record<string, keyof ContaInput> = {
  CATEGORIA: "categoria",
  BENEFICIARIO: "beneficiario",
  IDENTIFICACAO: "identificacao",
  VENCIMENTO: "vencimento",
  "DATA DE DEBITO": "dataDebito",
  SAIDAS: "saida",
  SAIDA: "saida",
  STATUS: "status",
  OBSERVACOES: "observacoes",
};

/** Caixa alta, sem acentos e com espaços simples: base de todas as comparações. */
export function normalizar(s: string): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Células com "-" ou "?" na planilha significam "sem valor". */
function texto(v: XlsxCelula): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s === "-" || s === "?" ? "" : s;
}

/** Último dia (28-31) do mês "yyyy-mm". */
function ultimoDia(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Célula de data -> "yyyy-mm-dd", ou "" se não há data. Aceita o serial do Excel e textos
 * "dd/mm/aaaa" (inclusive com "//" digitado por engano); um dia além do fim do mês
 * (ex.: 31/04) vira o último dia dele.
 */
function data(v: XlsxCelula, data1904: boolean): string {
  if (typeof v === "number") return serialParaIso(v, data1904);
  const m = /^(\d{1,2})\/+(\d{1,2})\/+(\d{4})$/.exec(texto(v));
  if (!m) return "";
  const [d, mm, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mm < 1 || mm > 12 || d < 1) return "";
  const mes = `${y}-${String(mm).padStart(2, "0")}`;
  return `${mes}-${String(Math.min(d, ultimoDia(mes))).padStart(2, "0")}`;
}

function valor(v: XlsxCelula): string {
  if (typeof v === "number") return fmt(v);
  return normalizeMoney(texto(v));
}

/** Mês (1-12) da aba pelo nome dela ("JAN", "Janeiro"...) ou pelo "MÊS CORRENTE:" da linha 1. */
function mesDaAba(nome: string, linhas: XlsxCelula[][]): number | null {
  const candidatos = [nome, ...(linhas[0] ?? []).map((c) => texto(c))];
  for (const c of candidatos) {
    const n = normalizar(c);
    if (n.length < 3) continue;
    const i = MESES.findIndex((m) => m === n || (n.length === 3 && m.startsWith(n)));
    if (i >= 0) return i + 1;
  }
  return null;
}

/**
 * Nome da categoria como já cadastrada (sem diferenciar acentos e maiúsculas); se for nova,
 * fica como está na planilha (siglas como IPTU não podem virar "Iptu").
 */
export function nomeCategoria(bruto: string, existentes: string[]): string {
  const alvo = normalizar(bruto);
  return existentes.find((c) => normalizar(c) === alvo) ?? bruto.trim().replace(/\s+/g, " ");
}

export interface AbaImportada {
  aba: string;
  /** "yyyy-mm" */
  mes: string;
  contas: ContaInput[];
}

/**
 * Lê as abas mensais da planilha. `anoPadrao` vale para abas sem nenhum vencimento com data;
 * nas demais o ano é o mais comum entre os vencimentos. Conta sem vencimento (ou com um
 * texto que não é data) fica com o dia 1º do mês da aba, para cair no mês certo.
 */
export function lerPlanilhaContas(bytes: Uint8Array, opts: { anoPadrao: number; categorias: string[] }): AbaImportada[] {
  const { abas, data1904 } = lerXlsx(bytes);
  const resultado: AbaImportada[] = [];

  for (const { nome, linhas } of abas) {
    const iCab = linhas.slice(0, 10).findIndex((l) => l.some((c) => normalizar(texto(c)) === "CATEGORIA"));
    const mesNum = mesDaAba(nome, linhas);
    if (iCab < 0 || mesNum == null) continue;

    const campos = new Map<number, keyof ContaInput>();
    linhas[iCab].forEach((c, i) => {
      const campo = COLUNAS[normalizar(texto(c))];
      if (campo && ![...campos.values()].includes(campo)) campos.set(i, campo);
    });

    const brutas = linhas.slice(iCab + 1).map((l) => {
      const conta: ContaInput = { categoria: "", beneficiario: "", identificacao: "", vencimento: "", dataDebito: "", saida: "", status: "Em Aberto", observacoes: "" };
      for (const [i, campo] of campos) {
        const v = l[i] ?? null;
        if (campo === "vencimento" || campo === "dataDebito") conta[campo] = data(v, data1904);
        else if (campo === "saida") conta.saida = valor(v);
        else if (campo === "status") conta.status = STATUS[normalizar(texto(v))] ?? "Em Aberto";
        else conta[campo] = texto(v);
      }
      return conta;
    });
    const contas = brutas.filter((c) => c.categoria && c.beneficiario);

    const anos = new Map<number, number>();
    for (const c of contas) {
      const ano = Number(c.vencimento.slice(0, 4));
      if (ano) anos.set(ano, (anos.get(ano) ?? 0) + 1);
    }
    const ano = [...anos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? opts.anoPadrao;
    const mes = `${ano}-${String(mesNum).padStart(2, "0")}`;

    const categorias = [...opts.categorias];
    for (const c of contas) {
      c.categoria = nomeCategoria(c.categoria, categorias);
      if (!categorias.includes(c.categoria)) categorias.push(c.categoria);
      if (!c.vencimento) c.vencimento = `${mes}-01`;
    }
    resultado.push({ aba: nome, mes, contas });
  }

  return resultado;
}

/** Ano de referência pelo nome do arquivo (ex.: "..._2026.xlsx"), ou o ano atual. */
export function anoDoArquivo(nome: string): number {
  const m = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(nome);
  return m ? Number(m[1]) : new Date().getFullYear();
}

type ContaChave = Pick<ContaInput, "beneficiario" | "identificacao" | "saida" | "vencimento" | "dataDebito">;

/**
 * Identifica a conta para não importá-la duas vezes: nome (beneficiário + identificação,
 * o mesmo que vai no nome do PDF), valor e mês/ano do vencimento.
 */
export function chaveConta(c: Omit<ContaChave, "dataDebito">): string {
  const v = parseBRL(c.saida);
  const centavos = v == null ? "" : String(Math.round(v * 100));
  return [normalizar(c.beneficiario), normalizar(c.identificacao), centavos, mesDeVencimento(c.vencimento)].join("|");
}

/** Chave de uma conta sem mês: nome, valor e a data de débito exata. */
const chaveSemMes = (c: ContaChave) => `${chaveConta({ ...c, vencimento: "" })}|${c.dataDebito}`;

/**
 * Separa as contas da planilha que ainda não existem das que já estão cadastradas.
 * Uma conta cadastrada sem vencimento (a importação antiga deixava assim quem tinha "-" ou
 * uma data impossível) não tem mês: ela conta como já existente para uma linha da planilha
 * com o mesmo nome, valor e data de débito, mas só para uma.
 */
export function separarDuplicadas<T extends ContaChave>(planilha: T[], existentes: ContaChave[]): { novas: T[]; duplicadas: T[] } {
  const chaves = new Set<string>();
  const semMes = new Map<string, number>();
  for (const c of existentes) {
    if (mesDeVencimento(c.vencimento)) chaves.add(chaveConta(c));
    else semMes.set(chaveSemMes(c), (semMes.get(chaveSemMes(c)) ?? 0) + 1);
  }

  const novas: T[] = [];
  const duplicadas: T[] = [];
  for (const c of planilha) {
    const livres = semMes.get(chaveSemMes(c)) ?? 0;
    if (chaves.has(chaveConta(c))) duplicadas.push(c);
    else if (livres > 0) {
      semMes.set(chaveSemMes(c), livres - 1);
      duplicadas.push(c);
    } else novas.push(c);
  }
  return { novas, duplicadas };
}

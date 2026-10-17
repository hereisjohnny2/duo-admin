import { getServerSupabase } from "./supabase";
import { clampQtd, nextCodigo } from "./inventario";
import { nomeCategoria, separarDuplicadas } from "./contasPlanilha";
import { mensagemErroBanco } from "./mensagensErro";
import type { Categoria, Conta, ContaInput, ImportacaoContas, InventarioItem, InventarioItemInput } from "./types";

/* =====================================================================
   Camada de dados — Supabase (PostgreSQL).
   Mapeia colunas snake_case do Postgres <-> campos camelCase do app.
   Só pode ser importado no servidor (route handlers).
   ===================================================================== */

/** Erro do banco para devolver à tela: a mensagem em português; o original (em inglês) vai para o log. */
function erroBanco(error: { code?: string; message: string }): Error {
  console.error("Erro do banco:", error.code, error.message);
  return new Error(mensagemErroBanco(error));
}

/* =====================================================================
   Contas + Categorias
   ===================================================================== */

const CONTA_FIELDS: (keyof ContaInput)[] = [
  "categoria",
  "beneficiario",
  "identificacao",
  "vencimento",
  "dataDebito",
  "saida",
  "status",
  "observacoes",
];

const CONTA_COL: Record<keyof ContaInput, string> = {
  categoria: "categoria",
  beneficiario: "beneficiario",
  identificacao: "identificacao",
  vencimento: "vencimento",
  dataDebito: "data_debito",
  saida: "saida",
  status: "status",
  observacoes: "observacoes",
};

const CONTA_SELECT =
  "id, categoria, beneficiario, identificacao, vencimento, data_debito, saida, status, observacoes, pdf_path, boleto_path, boleto_nome, boleto_paginas, comprovante_path, comprovante_nome, comprovante_paginas";

interface ContaRow {
  id: string;
  categoria: string;
  beneficiario: string;
  identificacao: string;
  vencimento: string;
  data_debito: string;
  saida: string;
  status: string;
  observacoes: string;
  pdf_path: string;
  boleto_path: string;
  boleto_nome: string;
  boleto_paginas: number;
  comprovante_path: string;
  comprovante_nome: string;
  comprovante_paginas: number;
}

/** Arquivos da conta, como gravados no banco. Uma parte com `path` vazio está dentro do pdfPath. */
export interface ContaPdfRow {
  pdfPath: string;
  boleto: { nome: string; paginas: number; path: string } | null;
  comprovante: { nome: string; paginas: number; path: string } | null;
}

function toArquivo(path: string) {
  return path ? { path, nome: path.slice(path.lastIndexOf("/") + 1) } : null;
}

function toParte(nome: string, paginas: number, path: string) {
  return paginas > 0 ? { nome, paginas, arquivo: toArquivo(path) } : null;
}

function rowToConta(r: ContaRow): Conta {
  return {
    id: r.id,
    categoria: r.categoria,
    beneficiario: r.beneficiario,
    identificacao: r.identificacao,
    vencimento: r.vencimento,
    dataDebito: r.data_debito,
    saida: r.saida,
    status: r.status,
    observacoes: r.observacoes,
    boleto: toParte(r.boleto_nome, r.boleto_paginas, r.boleto_path),
    comprovante: toParte(r.comprovante_nome, r.comprovante_paginas, r.comprovante_path),
    pdf: toArquivo(r.pdf_path),
  };
}

function patchToContaRow(patch: Partial<ContaInput>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const key of CONTA_FIELDS) {
    if (patch[key] !== undefined) row[CONTA_COL[key]] = String(patch[key]);
  }
  return row;
}

export function sanitizeConta(body: unknown): ContaInput {
  const src = (body ?? {}) as Record<string, unknown>;
  const out = {} as ContaInput;
  for (const key of CONTA_FIELDS) out[key] = src[key] == null ? "" : String(src[key]);
  return out;
}

export function pickContaPatch(body: unknown): Partial<ContaInput> {
  const src = (body ?? {}) as Record<string, unknown>;
  const out: Partial<ContaInput> = {};
  for (const key of CONTA_FIELDS) if (src[key] !== undefined) out[key] = String(src[key]);
  return out;
}

export async function listContas(): Promise<Conta[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").select(CONTA_SELECT).order("vencimento", { ascending: true });
  if (error) throw erroBanco(error);
  return ((data ?? []) as unknown as ContaRow[]).map(rowToConta);
}

export async function insertConta(input: ContaInput): Promise<Conta> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").insert(patchToContaRow(input)).select(CONTA_SELECT).single();
  if (error) throw erroBanco(error);
  return rowToConta(data as unknown as ContaRow);
}

export async function updateConta(id: string, patch: Partial<ContaInput>): Promise<Conta | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").update(patchToContaRow(patch)).eq("id", id).select(CONTA_SELECT).maybeSingle();
  if (error) throw erroBanco(error);
  return data ? rowToConta(data as unknown as ContaRow) : null;
}

export async function getConta(id: string): Promise<Conta | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").select(CONTA_SELECT).eq("id", id).maybeSingle();
  if (error) throw erroBanco(error);
  return data ? rowToConta(data as unknown as ContaRow) : null;
}

/** Grava os arquivos da conta: o PDF único (se juntado) e cada parte. */
export async function setContaPdf(id: string, pdf: ContaPdfRow): Promise<Conta | null> {
  const supabase = getServerSupabase();
  const row = {
    pdf_path: pdf.pdfPath,
    boleto_path: pdf.boleto?.path ?? "",
    boleto_nome: pdf.boleto?.nome ?? "",
    boleto_paginas: pdf.boleto?.paginas ?? 0,
    comprovante_path: pdf.comprovante?.path ?? "",
    comprovante_nome: pdf.comprovante?.nome ?? "",
    comprovante_paginas: pdf.comprovante?.paginas ?? 0,
  };
  const { data, error } = await supabase.from("contas").update(row).eq("id", id).select(CONTA_SELECT).maybeSingle();
  if (error) throw erroBanco(error);
  return data ? rowToConta(data as unknown as ContaRow) : null;
}

/** Remove a conta e devolve como ela estava (para apagar os arquivos no Storage), ou null se não existia. */
export async function deleteConta(id: string): Promise<Conta | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").delete().eq("id", id).select(CONTA_SELECT).maybeSingle();
  if (error) throw erroBanco(error);
  return data ? rowToConta(data as unknown as ContaRow) : null;
}

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("categorias").select("id, nome").order("nome", { ascending: true });
  if (error) throw erroBanco(error);
  return (data ?? []) as unknown as Categoria[];
}

export async function insertCategoria(nome: string): Promise<Categoria> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("categorias").insert({ nome }).select("id, nome").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: findError } = await supabase.from("categorias").select("id, nome").eq("nome", nome).single();
      if (findError) throw erroBanco(findError);
      return existing as unknown as Categoria;
    }
    throw erroBanco(error);
  }
  return data as unknown as Categoria;
}

/** Último dia (1-31) do mês "yyyy-mm". */
function lastDayOfMonth(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** "yyyy-mm-dd" (mês origem) -> "yyyy-mm-dd" no mês destino, mantendo o dia (com clamp para meses mais curtos). */
function shiftVencimento(vencimento: string, mesDestino: string): string {
  const dia = Number(vencimento.slice(8, 10));
  const diaClamped = Math.min(dia, lastDayOfMonth(mesDestino));
  return `${mesDestino}-${String(diaClamped).padStart(2, "0")}`;
}

/**
 * Duplica todas as contas cujo vencimento cai em `mesOrigem` ("yyyy-mm") para `mesDestino`.
 * As cópias entram com status "Em Aberto" e sem data de débito (ainda não pagas no novo mês).
 */
export async function duplicateContasMes(mesOrigem: string, mesDestino: string): Promise<Conta[]> {
  const supabase = getServerSupabase();
  const { data: origem, error: selectError } = await supabase.from("contas").select(CONTA_SELECT).like("vencimento", `${mesOrigem}-%`);
  if (selectError) throw erroBanco(selectError);

  const rows = ((origem ?? []) as unknown as ContaRow[]).map(rowToConta);
  if (rows.length === 0) return [];

  const novasRows = rows.map((c) =>
    patchToContaRow({
      categoria: c.categoria,
      beneficiario: c.beneficiario,
      identificacao: c.identificacao,
      vencimento: c.vencimento ? shiftVencimento(c.vencimento, mesDestino) : "",
      dataDebito: "",
      saida: c.saida,
      status: "Em Aberto",
      observacoes: c.observacoes,
    })
  );

  const { data, error } = await supabase.from("contas").insert(novasRows).select(CONTA_SELECT);
  if (error) throw erroBanco(error);
  return ((data ?? []) as unknown as ContaRow[]).map(rowToConta);
}

/**
 * Importa as contas lidas da planilha. Pula as que já existem (beneficiário + identificação,
 * valor e mês/ano do vencimento; ver separarDuplicadas) e cadastra as categorias que ainda não existem. O mês passa
 * a existir no app assim que uma conta com vencimento nele é criada.
 */
export async function importContas(contas: ContaInput[]): Promise<ImportacaoContas> {
  const supabase = getServerSupabase();
  const { data: existentes, error: selectError } = await supabase.from("contas").select("beneficiario, identificacao, saida, vencimento, dataDebito:data_debito");
  if (selectError) throw erroBanco(selectError);

  const { novas, duplicadas } = separarDuplicadas(contas, (existentes ?? []) as unknown as ContaInput[]);
  if (novas.length === 0) return { importadas: [], ignoradas: duplicadas.length, categorias: [] };

  const nomes = (await listCategorias()).map((c) => c.nome);
  const faltando: string[] = [];
  for (const c of novas) {
    c.categoria = nomeCategoria(c.categoria, [...nomes, ...faltando]);
    if (!nomes.includes(c.categoria) && !faltando.includes(c.categoria)) faltando.push(c.categoria);
  }

  let categorias: Categoria[] = [];
  if (faltando.length > 0) {
    const { data, error } = await supabase
      .from("categorias")
      .upsert(
        faltando.map((nome) => ({ nome })),
        { onConflict: "nome", ignoreDuplicates: true }
      )
      .select("id, nome");
    if (error) throw erroBanco(error);
    categorias = (data ?? []) as unknown as Categoria[];
  }

  const { data, error } = await supabase.from("contas").insert(novas.map(patchToContaRow)).select(CONTA_SELECT);
  if (error) throw erroBanco(error);
  return { importadas: ((data ?? []) as unknown as ContaRow[]).map(rowToConta), ignoradas: duplicadas.length, categorias };
}

/* =====================================================================
   Inventário — itens de estoque do galpão.
   ===================================================================== */

const INVENTARIO_FIELDS: (keyof InventarioItemInput)[] = ["produto", "categoria", "quantidade", "unidade", "estoqueMinimo", "localizacao", "observacoes"];

/** Campo camelCase (app) -> coluna snake_case (Postgres). */
const INVENTARIO_COL: Record<keyof InventarioItemInput, string> = {
  produto: "produto",
  categoria: "categoria",
  quantidade: "quantidade",
  unidade: "unidade",
  estoqueMinimo: "estoque_minimo",
  localizacao: "localizacao",
  observacoes: "observacoes",
};

const INVENTARIO_SELECT = "id, codigo, produto, categoria, quantidade, unidade, estoque_minimo, localizacao, observacoes";

interface InventarioRow {
  id: string;
  codigo: string;
  produto: string;
  categoria: string;
  quantidade: number | string;
  unidade: string;
  estoque_minimo: number | string;
  localizacao: string;
  observacoes: string;
}

function rowToInventarioItem(r: InventarioRow): InventarioItem {
  return {
    id: r.id,
    codigo: r.codigo,
    produto: r.produto,
    categoria: r.categoria,
    // numeric do Postgres chega como string no supabase-js.
    quantidade: Number(r.quantidade),
    unidade: r.unidade,
    estoqueMinimo: Number(r.estoque_minimo),
    localizacao: r.localizacao,
    observacoes: r.observacoes,
  };
}

/** Converte um patch camelCase em colunas snake_case (apenas campos presentes). */
function inventarioPatchToRow(patch: Partial<InventarioItemInput>): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const key of INVENTARIO_FIELDS) {
    const value = patch[key];
    if (value === undefined) continue;
    row[INVENTARIO_COL[key]] = key === "quantidade" || key === "estoqueMinimo" ? clampQtd(Number(value)) : String(value);
  }
  return row;
}

/** Normaliza o corpo em um InventarioItemInput completo. */
export function sanitizeInventarioItem(body: unknown): InventarioItemInput {
  const src = (body ?? {}) as Record<string, unknown>;
  return {
    produto: src.produto == null ? "" : String(src.produto),
    categoria: src.categoria == null ? "" : String(src.categoria),
    quantidade: clampQtd(Number(src.quantidade)),
    unidade: src.unidade == null ? "un" : String(src.unidade),
    estoqueMinimo: clampQtd(Number(src.estoqueMinimo)),
    localizacao: src.localizacao == null ? "" : String(src.localizacao),
    observacoes: src.observacoes == null ? "" : String(src.observacoes),
  };
}

/** Extrai apenas os campos presentes no corpo (para updates parciais). */
export function pickInventarioPatch(body: unknown): Partial<InventarioItemInput> {
  const src = (body ?? {}) as Record<string, unknown>;
  const out: Partial<InventarioItemInput> = {};
  for (const key of INVENTARIO_FIELDS) {
    if (src[key] === undefined) continue;
    if (key === "quantidade" || key === "estoqueMinimo") out[key] = clampQtd(Number(src[key]));
    else out[key] = String(src[key]);
  }
  return out;
}

/* ---- Operações ---- */

export async function listInventario(): Promise<InventarioItem[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("inventario_itens").select(INVENTARIO_SELECT).order("codigo", { ascending: true });
  if (error) throw erroBanco(error);
  return ((data ?? []) as unknown as InventarioRow[]).map(rowToInventarioItem);
}

export async function insertInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  const supabase = getServerSupabase();

  // O código segue a categoria (ex.: HID-035), então é gerado a partir dos já usados nela.
  const { data: usados, error: listError } = await supabase.from("inventario_itens").select("codigo").eq("categoria", input.categoria);
  if (listError) throw erroBanco(listError);

  const codigo = nextCodigo(
    input.categoria,
    ((usados ?? []) as { codigo: string }[]).map((r) => r.codigo)
  );

  const { data, error } = await supabase
    .from("inventario_itens")
    .insert({ codigo, ...inventarioPatchToRow(input) })
    .select(INVENTARIO_SELECT)
    .single();
  if (error) throw erroBanco(error);
  return rowToInventarioItem(data as unknown as InventarioRow);
}

export async function updateInventarioItem(id: string, patch: Partial<InventarioItemInput>): Promise<InventarioItem | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("inventario_itens").update(inventarioPatchToRow(patch)).eq("id", id).select(INVENTARIO_SELECT).maybeSingle();
  if (error) throw erroBanco(error);
  return data ? rowToInventarioItem(data as unknown as InventarioRow) : null;
}

export async function deleteInventarioItem(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("inventario_itens").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw erroBanco(error);
  return data != null;
}

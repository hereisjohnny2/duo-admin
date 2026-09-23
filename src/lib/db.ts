import { getServerSupabase } from "./supabase";
import { clampQtd, nextCodigo } from "./inventario";
import type { Acordo, AcordoInput, Categoria, Conta, ContaInput, InventarioItem, InventarioItemInput, Parcela } from "./types";

/* =====================================================================
   Camada de dados — Supabase (PostgreSQL).
   Mapeia colunas snake_case do Postgres <-> campos camelCase do app.
   Só pode ser importado no servidor (route handlers).
   ===================================================================== */

const FIELDS: (keyof AcordoInput)[] = [
  "devedor",
  "emitente",
  "tipo",
  "valorParcela",
  "qtd",
  "valorTotal",
  "parcelasPagas",
  "valorPago",
  "vencimento",
  "periodo",
  "status",
  "obs",
  "anotacao",
];

/** Campo camelCase (app) -> coluna snake_case (Postgres). */
const COL: Record<keyof AcordoInput, string> = {
  devedor: "devedor",
  emitente: "emitente",
  tipo: "tipo",
  valorParcela: "valor_parcela",
  qtd: "qtd",
  valorTotal: "valor_total",
  parcelasPagas: "parcelas_pagas",
  valorPago: "valor_pago",
  vencimento: "vencimento",
  periodo: "periodo",
  status: "status",
  obs: "obs",
  anotacao: "anotacao",
};

const ACORDO_SELECT = "id, devedor, emitente, tipo, valor_parcela, qtd, valor_total, parcelas_pagas, valor_pago, vencimento, periodo, status, obs, anotacao";

interface AcordoRow {
  id: string;
  devedor: string;
  emitente: string;
  tipo: string;
  valor_parcela: string;
  qtd: string;
  valor_total: string;
  parcelas_pagas: string;
  valor_pago: string;
  vencimento: string;
  periodo: string;
  status: string;
  obs: string;
  anotacao: string;
}

function rowToAcordo(r: AcordoRow): Acordo {
  return {
    id: r.id,
    devedor: r.devedor,
    emitente: r.emitente,
    tipo: r.tipo,
    valorParcela: r.valor_parcela,
    qtd: r.qtd,
    valorTotal: r.valor_total,
    parcelasPagas: r.parcelas_pagas,
    valorPago: r.valor_pago,
    vencimento: r.vencimento,
    periodo: r.periodo,
    status: r.status,
    obs: r.obs,
    anotacao: r.anotacao,
  };
}

/** Converte um patch camelCase em colunas snake_case (apenas campos presentes). */
function patchToRow(patch: Partial<AcordoInput>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const key of FIELDS) {
    if (patch[key] !== undefined) row[COL[key]] = String(patch[key]);
  }
  return row;
}

/** Normaliza o corpo em um AcordoInput completo (todos os campos como string). */
export function sanitizeAcordo(body: unknown): AcordoInput {
  const src = (body ?? {}) as Record<string, unknown>;
  const out = {} as AcordoInput;
  for (const key of FIELDS) out[key] = src[key] == null ? "" : String(src[key]);
  return out;
}

/** Extrai apenas os campos presentes no corpo (para updates parciais). */
export function pickAcordoPatch(body: unknown): Partial<AcordoInput> {
  const src = (body ?? {}) as Record<string, unknown>;
  const out: Partial<AcordoInput> = {};
  for (const key of FIELDS) if (src[key] !== undefined) out[key] = String(src[key]);
  return out;
}

/* ---- Operações ---- */

export async function listAcordos(): Promise<Acordo[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("acordos").select(ACORDO_SELECT).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AcordoRow[]).map(rowToAcordo);
}

export async function insertAcordo(input: AcordoInput): Promise<Acordo> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("acordos").insert(patchToRow(input)).select(ACORDO_SELECT).single();
  if (error) throw new Error(error.message);
  return rowToAcordo(data as unknown as AcordoRow);
}

export async function updateAcordo(id: string, patch: Partial<AcordoInput>): Promise<Acordo | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("acordos").update(patchToRow(patch)).eq("id", id).select(ACORDO_SELECT).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAcordo(data as unknown as AcordoRow) : null;
}

export async function deleteAcordo(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("acordos").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}

export async function listParcelas(): Promise<Parcela[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("parcelas").select("devedor, emitente, tipo, valor, data, status").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Parcela[];
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

const CONTA_SELECT = "id, categoria, beneficiario, identificacao, vencimento, data_debito, saida, status, observacoes";

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
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ContaRow[]).map(rowToConta);
}

export async function insertConta(input: ContaInput): Promise<Conta> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").insert(patchToContaRow(input)).select(CONTA_SELECT).single();
  if (error) throw new Error(error.message);
  return rowToConta(data as unknown as ContaRow);
}

export async function updateConta(id: string, patch: Partial<ContaInput>): Promise<Conta | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").update(patchToContaRow(patch)).eq("id", id).select(CONTA_SELECT).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToConta(data as unknown as ContaRow) : null;
}

export async function deleteConta(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("contas").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("categorias").select("id, nome").order("nome", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Categoria[];
}

export async function insertCategoria(nome: string): Promise<Categoria> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("categorias").insert({ nome }).select("id, nome").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: findError } = await supabase.from("categorias").select("id, nome").eq("nome", nome).single();
      if (findError) throw new Error(findError.message);
      return existing as unknown as Categoria;
    }
    throw new Error(error.message);
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
  if (selectError) throw new Error(selectError.message);

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
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ContaRow[]).map(rowToConta);
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
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as InventarioRow[]).map(rowToInventarioItem);
}

export async function insertInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  const supabase = getServerSupabase();

  // O código segue a categoria (ex.: HID-035), então é gerado a partir dos já usados nela.
  const { data: usados, error: listError } = await supabase.from("inventario_itens").select("codigo").eq("categoria", input.categoria);
  if (listError) throw new Error(listError.message);

  const codigo = nextCodigo(
    input.categoria,
    ((usados ?? []) as { codigo: string }[]).map((r) => r.codigo)
  );

  const { data, error } = await supabase
    .from("inventario_itens")
    .insert({ codigo, ...inventarioPatchToRow(input) })
    .select(INVENTARIO_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToInventarioItem(data as unknown as InventarioRow);
}

export async function updateInventarioItem(id: string, patch: Partial<InventarioItemInput>): Promise<InventarioItem | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("inventario_itens").update(inventarioPatchToRow(patch)).eq("id", id).select(INVENTARIO_SELECT).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToInventarioItem(data as unknown as InventarioRow) : null;
}

export async function deleteInventarioItem(id: string): Promise<boolean> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("inventario_itens").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}

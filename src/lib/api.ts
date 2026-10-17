import type { Categoria, Conta, ContaArquivoTipo, ContaInput, ImportacaoContas, InventarioItem, InventarioItemInput } from "./types";
import { contaParteUrl } from "./contasCompute";
import { ERRO_CONEXAO } from "./mensagensErro";

/* Cliente HTTP para a API de contas/categorias e do inventário. */

/** fetch que troca a falha de rede ("Failed to fetch", em inglês) por uma mensagem em português. */
function req(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, init).catch(() => {
    throw new Error(ERRO_CONEXAO);
  });
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? `Erro no servidor (${res.status}). Tente de novo.`);
  }
  return res.json() as Promise<T>;
}

/* ---- Contas / Categorias ---- */

export function getContas(): Promise<Conta[]> {
  return req("/api/contas", { cache: "no-store" }).then((r) => handle<Conta[]>(r));
}

export function createConta(input: ContaInput): Promise<Conta> {
  return req("/api/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<Conta>(r));
}

export function updateConta(id: string, patch: Partial<ContaInput>): Promise<Conta> {
  return req(`/api/contas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => handle<Conta>(r));
}

/** Envia (ou substitui) o boleto/comprovante como arquivo próprio; devolve a conta atualizada. */
export function uploadContaArquivo(id: string, tipo: ContaArquivoTipo, file: File): Promise<Conta> {
  const body = new FormData();
  body.append("file", file);
  return req(contaParteUrl(id, tipo), { method: "PUT", body }).then((r) => handle<Conta>(r));
}

export function deleteContaArquivo(id: string, tipo: ContaArquivoTipo): Promise<Conta> {
  return req(contaParteUrl(id, tipo), { method: "DELETE" }).then((r) => handle<Conta>(r));
}

/** Junta boleto + comprovante no PDF único BOL_... (os arquivos separados são apagados). */
export function juntarContaArquivos(id: string): Promise<Conta> {
  return req(`/api/contas/${id}/arquivos/juntar`, { method: "POST" }).then((r) => handle<Conta>(r));
}

export function deleteConta(id: string): Promise<{ ok: true }> {
  return req(`/api/contas/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: true }>(r));
}

export function duplicateContasMes(mesOrigem: string, mesDestino: string): Promise<Conta[]> {
  return req("/api/contas/duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mesOrigem, mesDestino }),
  }).then((r) => handle<Conta[]>(r));
}

/** Importa as contas lidas da planilha; o servidor pula as que já existem. */
export function importContas(contas: ContaInput[]): Promise<ImportacaoContas> {
  return req("/api/contas/importar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contas }),
  }).then((r) => handle<ImportacaoContas>(r));
}

export function getCategorias(): Promise<Categoria[]> {
  return req("/api/categorias", { cache: "no-store" }).then((r) => handle<Categoria[]>(r));
}

export function createCategoria(nome: string): Promise<Categoria> {
  return req("/api/categorias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  }).then((r) => handle<Categoria>(r));
}

/* ---- Inventário ---- */

export function getInventario(): Promise<InventarioItem[]> {
  return req("/api/inventario", { cache: "no-store" }).then((r) => handle<InventarioItem[]>(r));
}

export function createInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  return req("/api/inventario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<InventarioItem>(r));
}

export function updateInventarioItem(id: string, patch: Partial<InventarioItemInput>): Promise<InventarioItem> {
  return req(`/api/inventario/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => handle<InventarioItem>(r));
}

export function deleteInventarioItem(id: string): Promise<{ ok: true }> {
  return req(`/api/inventario/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: true }>(r));
}

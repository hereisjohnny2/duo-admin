import type { Acordo, AcordoInput, Categoria, Conta, ContaInput, InventarioItem, InventarioItemInput, Parcela } from "./types";

/* Cliente HTTP para a API de acordos/parcelas, contas/categorias e do inventário. */

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getAcordos(): Promise<Acordo[]> {
  return fetch("/api/acordos", { cache: "no-store" }).then((r) => handle<Acordo[]>(r));
}

export function getParcelas(): Promise<Parcela[]> {
  return fetch("/api/parcelas", { cache: "no-store" }).then((r) => handle<Parcela[]>(r));
}

export function createAcordo(input: AcordoInput): Promise<Acordo> {
  return fetch("/api/acordos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<Acordo>(r));
}

export function updateAcordo(id: string, patch: Partial<AcordoInput>): Promise<Acordo> {
  return fetch(`/api/acordos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => handle<Acordo>(r));
}

export function deleteAcordo(id: string): Promise<{ ok: true }> {
  return fetch(`/api/acordos/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: true }>(r));
}

/* ---- Contas / Categorias ---- */

export function getContas(): Promise<Conta[]> {
  return fetch("/api/contas", { cache: "no-store" }).then((r) => handle<Conta[]>(r));
}

export function createConta(input: ContaInput): Promise<Conta> {
  return fetch("/api/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<Conta>(r));
}

export function updateConta(id: string, patch: Partial<ContaInput>): Promise<Conta> {
  return fetch(`/api/contas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => handle<Conta>(r));
}

export function deleteConta(id: string): Promise<{ ok: true }> {
  return fetch(`/api/contas/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: true }>(r));
}

export function duplicateContasMes(mesOrigem: string, mesDestino: string): Promise<Conta[]> {
  return fetch("/api/contas/duplicate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mesOrigem, mesDestino }),
  }).then((r) => handle<Conta[]>(r));
}

export function getCategorias(): Promise<Categoria[]> {
  return fetch("/api/categorias", { cache: "no-store" }).then((r) => handle<Categoria[]>(r));
}

export function createCategoria(nome: string): Promise<Categoria> {
  return fetch("/api/categorias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  }).then((r) => handle<Categoria>(r));
}

/* ---- Inventário ---- */

export function getInventario(): Promise<InventarioItem[]> {
  return fetch("/api/inventario", { cache: "no-store" }).then((r) => handle<InventarioItem[]>(r));
}

export function createInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  return fetch("/api/inventario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<InventarioItem>(r));
}

export function updateInventarioItem(id: string, patch: Partial<InventarioItemInput>): Promise<InventarioItem> {
  return fetch(`/api/inventario/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => handle<InventarioItem>(r));
}

export function deleteInventarioItem(id: string): Promise<{ ok: true }> {
  return fetch(`/api/inventario/${id}`, { method: "DELETE" }).then((r) => handle<{ ok: true }>(r));
}

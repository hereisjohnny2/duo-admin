import { getServerSupabase } from "./supabase";
import type { ContaArquivoTipo } from "./types";

/* =====================================================================
   Boletos e comprovantes das contas — Supabase Storage.
   Bucket privado (ver migration contas_arquivos): o browser nunca fala
   com o Storage direto, sempre pela API /api/contas/:id/arquivos/:tipo.
   Só pode ser importado no servidor (route handlers).
   ===================================================================== */

export const CONTAS_BUCKET = "contas-arquivos";

/** Caminho único por envio, para que trocar o arquivo não sobrescreva o anterior antes do banco ser atualizado. */
export function contaArquivoPath(contaId: string, tipo: ContaArquivoTipo, fileName: string): string {
  const ext = /\.[a-z0-9]{1,8}$/i.exec(fileName)?.[0].toLowerCase() ?? "";
  return `${contaId}/${tipo}-${crypto.randomUUID()}${ext}`;
}

export async function uploadContaArquivo(path: string, file: { type: string; data: ArrayBuffer }): Promise<void> {
  const { error } = await getServerSupabase().storage.from(CONTAS_BUCKET).upload(path, file.data, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
}

/** Conteúdo do arquivo, ou null se ele não existe mais no Storage. */
export async function downloadContaArquivo(path: string): Promise<Blob | null> {
  const { data, error } = await getServerSupabase().storage.from(CONTAS_BUCKET).download(path);
  if (error) {
    const status = (error as { status?: number; statusCode?: string }).status ?? Number((error as { statusCode?: string }).statusCode);
    if (status === 404 || /not found/i.test(error.message)) return null;
    throw new Error(`Falha ao baixar o arquivo: ${error.message}`);
  }
  return data;
}

/** Apaga os arquivos; caminhos que já não existem são ignorados pelo Storage. */
export async function deleteContaArquivos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getServerSupabase().storage.from(CONTAS_BUCKET).remove(paths);
  if (error) throw new Error(`Falha ao apagar o arquivo: ${error.message}`);
}

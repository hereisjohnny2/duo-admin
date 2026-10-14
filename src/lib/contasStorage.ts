import { getServerSupabase } from "./supabase";
import { setContaPdf, type ContaPdfRow } from "./db";
import { ArquivoInvalidoError, juntarPartes, renomearTituloPdf, type ParteFonte } from "./contasPdf";
import { CONTA_ARQUIVO_TIPOS, nomePdfConta } from "./contasCompute";
import type { Conta, ContaArquivoTipo } from "./types";

/* =====================================================================
   PDF único das contas (boleto + comprovante) — Supabase Storage.
   Bucket privado (ver migrations contas_arquivos/contas_pdf_unico): o
   browser nunca fala com o Storage direto, sempre pela API
   /api/contas/:id/arquivos. Só pode ser importado no servidor.
   ===================================================================== */

export const CONTAS_BUCKET = "contas-arquivos";

const bucket = () => getServerSupabase().storage.from(CONTAS_BUCKET);

/**
 * <id da conta>/<uuid>/<nome>: o arquivo mantém o nome BOL_... e a pasta única
 * evita sobrescrever o PDF atual antes de o banco apontar para o novo.
 */
export function contaPdfPath(contaId: string, nome: string): string {
  return `${contaId}/${crypto.randomUUID()}/${nome}`;
}

/** Conteúdo do arquivo, ou null se ele não existe mais no Storage. */
export async function downloadContaPdf(path: string): Promise<Blob | null> {
  const { data, error } = await bucket().download(path);
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
  const { error } = await bucket().remove(paths);
  if (error) throw new Error(`Falha ao apagar o arquivo: ${error.message}`);
}

/** Apaga sem derrubar a requisição (o principal já foi feito); falhas só vão para o log. */
async function deleteQuietly(path: string) {
  await deleteContaArquivos([path]).catch((e) => console.error("Falha ao apagar arquivo da conta:", e));
}

/** Título do documento = nome do arquivo sem a extensão. */
const tituloPdf = (nome: string) => nome.replace(/\.pdf$/, "");

/** Envia o PDF para um caminho novo (nunca sobrescreve o atual) e devolve esse caminho. */
async function enviarPdf(contaId: string, nome: string, bytes: Uint8Array): Promise<string> {
  const path = contaPdfPath(contaId, nome);
  const { error } = await bucket().upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  return path;
}

/** Aponta a conta para o PDF recém-enviado; se não der, apaga o envio para não deixar órfão. */
async function gravarOuDesfazer(contaId: string, path: string, row: ContaPdfRow): Promise<Conta | null> {
  let updated;
  try {
    updated = await setContaPdf(contaId, row);
  } catch (e) {
    await deleteQuietly(path);
    throw e;
  }
  if (!updated) await deleteQuietly(path); // a conta foi excluída no meio do caminho
  return updated;
}

function erroSemVencimento() {
  return new ArquivoInvalidoError("Informe o vencimento da conta antes de anexar arquivos: o nome do PDF usa o mês e o ano dele.");
}

/**
 * Troca (ou remove, com `nova` null) uma parte do PDF da conta e grava só o PDF resultante.
 * A outra parte é reaproveitada das páginas do PDF atual.
 */
export async function salvarParteConta(conta: Conta, tipo: ContaArquivoTipo, nova: { nome: string; type: string; bytes: ArrayBuffer } | null): Promise<Conta | null> {
  const atual = conta.pdf ? await downloadContaPdf(conta.pdf.path) : null;
  const atualBytes = atual ? new Uint8Array(await atual.arrayBuffer()) : null;

  const partes: ParteFonte[] = [];
  const tipos: ContaArquivoTipo[] = [];
  const nomes: string[] = [];
  let inicio = 0;
  for (const t of CONTA_ARQUIVO_TIPOS) {
    const existente = conta[t];
    if (t === tipo) {
      if (nova) {
        partes.push({ bytes: nova.bytes, type: nova.type });
        tipos.push(t);
        nomes.push(nova.nome);
      }
    } else if (existente) {
      if (!atualBytes) throw new Error("O PDF atual da conta não foi encontrado no armazenamento. Anexe as duas partes de novo.");
      partes.push({ bytes: atualBytes, type: "application/pdf", paginas: [inicio, inicio + existente.paginas] });
      tipos.push(t);
      nomes.push(existente.nome);
    }
    inicio += existente?.paginas ?? 0;
  }

  // Nenhuma parte sobrou: a conta fica sem PDF.
  if (partes.length === 0) {
    const updated = await setContaPdf(conta.id, { pdfPath: "", boleto: null, comprovante: null });
    if (conta.pdf) await deleteQuietly(conta.pdf.path);
    return updated;
  }

  const nome = nomePdfConta(conta);
  if (!nome) throw erroSemVencimento();

  const montado = await juntarPartes(partes, tituloPdf(nome));
  const path = await enviarPdf(conta.id, nome, montado.bytes);

  const row: ContaPdfRow = { pdfPath: path, boleto: null, comprovante: null };
  tipos.forEach((t, i) => (row[t] = { nome: nomes[i], paginas: montado.paginas[i] }));

  const updated = await gravarOuDesfazer(conta.id, path, row);
  if (updated && conta.pdf) await deleteQuietly(conta.pdf.path);
  return updated;
}

/**
 * Depois de editar a conta, renomeia o PDF se categoria, beneficiário, identificação
 * ou vencimento mudaram (nome do arquivo e título do documento). Sem vencimento o
 * nome antigo é mantido.
 */
export async function renomearPdfConta(conta: Conta): Promise<Conta> {
  if (!conta.pdf) return conta;
  const nome = nomePdfConta(conta);
  if (!nome || nome === conta.pdf.nome) return conta;

  const atual = await downloadContaPdf(conta.pdf.path);
  if (!atual) throw new Error("O PDF atual da conta não foi encontrado no armazenamento.");
  const bytes = await renomearTituloPdf(await atual.arrayBuffer(), tituloPdf(nome));

  const path = await enviarPdf(conta.id, nome, bytes);
  const updated = await gravarOuDesfazer(conta.id, path, { pdfPath: path, boleto: conta.boleto, comprovante: conta.comprovante });
  if (!updated) return conta;
  await deleteQuietly(conta.pdf.path);
  return updated;
}

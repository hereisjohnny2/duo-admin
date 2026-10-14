import { getServerSupabase } from "./supabase";
import { setContaPdf, type ContaPdfRow } from "./db";
import { ArquivoInvalidoError, juntarPartes, renomearTituloPdf, type ParteFonte } from "./contasPdf";
import { CONTA_ARQUIVO_PREFIXO, CONTA_ARQUIVO_TIPOS, nomePdfConta } from "./contasCompute";
import type { Conta, ContaArquivoTipo } from "./types";

/* =====================================================================
   Arquivos das contas (boleto e comprovante) — Supabase Storage.
   Cada parte enviada vira um PDF próprio (BOL_... / COMP_...). Só o
   botão "Juntar" cria o PDF único BOL_... com as duas e apaga os
   separados; trocar/remover uma parte depois separa de novo.
   Bucket privado: o browser nunca fala com o Storage direto, sempre
   pela API /api/contas/:id/arquivos. Só pode ser importado no servidor.
   ===================================================================== */

export const CONTAS_BUCKET = "contas-arquivos";

const bucket = () => getServerSupabase().storage.from(CONTAS_BUCKET);

/**
 * <id da conta>/<uuid>/<nome>: o arquivo mantém o nome BOL_.../COMP_... e a pasta
 * única evita sobrescrever o arquivo atual antes de o banco apontar para o novo.
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

function erroSemVencimento() {
  return new ArquivoInvalidoError("Informe o vencimento da conta antes de anexar arquivos: o nome do PDF usa o mês e o ano dele.");
}

/** Nome do arquivo para a conta, ou erro se ela não tem vencimento. */
function nomeOuErro(conta: Conta, prefixo: "BOL" | "COMP"): string {
  const nome = nomePdfConta(conta, prefixo);
  if (!nome) throw erroSemVencimento();
  return nome;
}

async function baixarBytes(path: string): Promise<Uint8Array> {
  const blob = await downloadContaPdf(path);
  if (!blob) throw new Error("Um arquivo da conta não foi encontrado no armazenamento. Anexe-o de novo.");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Monta um PDF a partir das partes, envia e devolve o caminho e as páginas de cada parte. */
async function montarEEnviar(contaId: string, nome: string, partes: ParteFonte[]): Promise<{ path: string; paginas: number[] }> {
  const montado = await juntarPartes(partes, tituloPdf(nome));
  return { path: await enviarPdf(contaId, nome, montado.bytes), paginas: montado.paginas };
}

/**
 * Grava o novo estado da conta. Se não der, apaga o que acabou de ser enviado (para não
 * deixar órfãos); se der, apaga os arquivos que deixaram de ser usados.
 */
async function aplicar(contaId: string, row: ContaPdfRow, enviados: string[], obsoletos: string[]): Promise<Conta | null> {
  let updated;
  try {
    updated = await setContaPdf(contaId, row);
  } catch (e) {
    for (const path of enviados) await deleteQuietly(path);
    throw e;
  }
  if (!updated) {
    for (const path of enviados) await deleteQuietly(path); // a conta foi excluída no meio do caminho
    return null;
  }
  for (const path of obsoletos) await deleteQuietly(path);
  return updated;
}

/** Estado atual dos arquivos da conta, no formato do banco. */
function estadoAtual(conta: Conta): ContaPdfRow {
  const parte = (t: ContaArquivoTipo) => {
    const p = conta[t];
    return p ? { nome: p.nome, paginas: p.paginas, path: p.arquivo?.path ?? "" } : null;
  };
  return { pdfPath: conta.pdf?.path ?? "", boleto: parte("boleto"), comprovante: parte("comprovante") };
}

/** Todos os arquivos da conta no Storage. */
export function caminhosDaConta(conta: Conta): string[] {
  return [conta.pdf?.path, conta.boleto?.arquivo?.path, conta.comprovante?.arquivo?.path].filter((p): p is string => !!p);
}

/**
 * Envia (ou remove, com `nova` null) o boleto ou o comprovante como um arquivo próprio.
 * Se as partes estavam juntas, o PDF único é desfeito: a outra parte volta a ter arquivo próprio.
 */
export async function salvarParteConta(conta: Conta, tipo: ContaArquivoTipo, nova: { nome: string; type: string; bytes: ArrayBuffer } | null): Promise<Conta | null> {
  const row = estadoAtual(conta);
  const enviados: string[] = [];
  const obsoletos: string[] = [];

  try {
    // Desfaz o PDF único: a outra parte é recortada dele para um arquivo próprio.
    if (conta.pdf) {
      const juntado = await baixarBytes(conta.pdf.path);
      let inicio = 0;
      for (const t of CONTA_ARQUIVO_TIPOS) {
        const parte = conta[t];
        if (t !== tipo && parte) {
          const enviado = await montarEEnviar(conta.id, nomeOuErro(conta, CONTA_ARQUIVO_PREFIXO[t]), [
            { bytes: juntado, type: "application/pdf", paginas: [inicio, inicio + parte.paginas] },
          ]);
          enviados.push(enviado.path);
          row[t] = { nome: parte.nome, paginas: enviado.paginas[0], path: enviado.path };
        }
        inicio += parte?.paginas ?? 0;
      }
      obsoletos.push(conta.pdf.path);
      row.pdfPath = "";
    }

    const anterior = conta[tipo]?.arquivo;
    if (anterior) obsoletos.push(anterior.path);
    if (nova) {
      const enviado = await montarEEnviar(conta.id, nomeOuErro(conta, CONTA_ARQUIVO_PREFIXO[tipo]), [{ bytes: nova.bytes, type: nova.type }]);
      enviados.push(enviado.path);
      row[tipo] = { nome: nova.nome, paginas: enviado.paginas[0], path: enviado.path };
    } else {
      row[tipo] = null;
    }
  } catch (e) {
    for (const path of enviados) await deleteQuietly(path);
    throw e;
  }

  return aplicar(conta.id, row, enviados, obsoletos);
}

/** Junta boleto + comprovante no PDF único BOL_... e apaga os arquivos separados. */
export async function juntarConta(conta: Conta): Promise<Conta | null> {
  const { boleto, comprovante } = conta;
  if (conta.pdf) throw new ArquivoInvalidoError("Boleto e comprovante já estão juntos.");
  if (!boleto?.arquivo || !comprovante?.arquivo) throw new ArquivoInvalidoError("Anexe o boleto e o comprovante para juntar.");

  const nome = nomeOuErro(conta, "BOL");
  const enviado = await montarEEnviar(conta.id, nome, [
    { bytes: await baixarBytes(boleto.arquivo.path), type: "application/pdf" },
    { bytes: await baixarBytes(comprovante.arquivo.path), type: "application/pdf" },
  ]);

  const row: ContaPdfRow = {
    pdfPath: enviado.path,
    boleto: { nome: boleto.nome, paginas: enviado.paginas[0], path: "" },
    comprovante: { nome: comprovante.nome, paginas: enviado.paginas[1], path: "" },
  };
  return aplicar(conta.id, row, [enviado.path], [boleto.arquivo.path, comprovante.arquivo.path]);
}

/**
 * Depois de editar a conta, renomeia os arquivos dela se categoria, beneficiário,
 * identificação ou vencimento mudaram (nome do arquivo e título do documento).
 * Sem vencimento os nomes antigos são mantidos.
 */
export async function renomearPdfConta(conta: Conta): Promise<Conta> {
  const row = estadoAtual(conta);
  const enviados: string[] = [];
  const obsoletos: string[] = [];

  const renomear = async (arquivo: { path: string; nome: string }, prefixo: "BOL" | "COMP"): Promise<string> => {
    const nome = nomePdfConta(conta, prefixo);
    if (!nome || nome === arquivo.nome) return arquivo.path;
    const bytes = await renomearTituloPdf(await baixarBytes(arquivo.path), tituloPdf(nome));
    const path = await enviarPdf(conta.id, nome, bytes);
    enviados.push(path);
    obsoletos.push(arquivo.path);
    return path;
  };

  try {
    if (conta.pdf) row.pdfPath = await renomear(conta.pdf, "BOL");
    for (const t of CONTA_ARQUIVO_TIPOS) {
      const arquivo = conta[t]?.arquivo;
      const parte = row[t];
      if (arquivo && parte) row[t] = { ...parte, path: await renomear(arquivo, CONTA_ARQUIVO_PREFIXO[t]) };
    }
  } catch (e) {
    for (const path of enviados) await deleteQuietly(path);
    throw e;
  }
  if (enviados.length === 0) return conta;
  return (await aplicar(conta.id, row, enviados, obsoletos)) ?? conta;
}

import { PDFDocument } from "pdf-lib";

/* =====================================================================
   PDF único da conta: boleto + comprovante juntos em um só arquivo.
   O Storage guarda só esse PDF; as páginas de cada parte ficam
   registradas no banco (boleto primeiro, depois o comprovante), para
   trocar ou remover uma parte sem precisar do arquivo original da outra.
   ===================================================================== */

/** A4 em pontos (1/72"). Imagens viram uma página A4 com margem. */
const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;

/** Uma parte do PDF final: um arquivo enviado agora, ou um trecho de um PDF já montado. */
export interface ParteFonte {
  bytes: Uint8Array | ArrayBuffer;
  type: string;
  /** Intervalo de páginas [início, fim) a aproveitar de um PDF; omitido = todas. */
  paginas?: [number, number];
}

export interface PdfMontado {
  bytes: Uint8Array;
  /** Quantidade de páginas de cada parte, na mesma ordem das partes recebidas. */
  paginas: number[];
}

/** Erro de conteúdo (arquivo corrompido, protegido etc.): a API responde 400. */
export class ArquivoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArquivoInvalidoError";
  }
}

async function carregarPdf(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(e.message)) {
      throw new ArquivoInvalidoError("O PDF está protegido por senha. Envie uma versão sem proteção.");
    }
    throw new ArquivoInvalidoError("Não foi possível ler o PDF. Verifique se o arquivo não está corrompido.");
  }
}

/** Copia as páginas da parte para `destino` e devolve quantas foram adicionadas. */
async function adicionarParte(destino: PDFDocument, parte: ParteFonte): Promise<number> {
  if (parte.type === "application/pdf") {
    const origem = await carregarPdf(parte.bytes);
    const [inicio, fim] = parte.paginas ?? [0, origem.getPageCount()];
    const indices = Array.from({ length: Math.max(0, fim - inicio) }, (_, i) => inicio + i);
    const copiadas = await destino.copyPages(origem, indices);
    for (const pagina of copiadas) destino.addPage(pagina);
    return copiadas.length;
  }

  let imagem;
  try {
    imagem = parte.type === "image/png" ? await destino.embedPng(parte.bytes) : await destino.embedJpg(parte.bytes);
  } catch {
    throw new ArquivoInvalidoError("Não foi possível ler a imagem. Verifique se o arquivo não está corrompido.");
  }
  // Cabe a imagem na área útil da página, sem ampliar além do tamanho original.
  const escala = Math.min((A4[0] - 2 * MARGEM) / imagem.width, (A4[1] - 2 * MARGEM) / imagem.height, 1);
  const largura = imagem.width * escala;
  const altura = imagem.height * escala;
  const pagina = destino.addPage(A4);
  pagina.drawImage(imagem, { x: (A4[0] - largura) / 2, y: A4[1] - MARGEM - altura, width: largura, height: altura });
  return 1;
}

/** Mesmo PDF com outro título (o visualizador do navegador mostra o título na aba). */
export async function renomearTituloPdf(bytes: Uint8Array | ArrayBuffer, titulo: string): Promise<Uint8Array> {
  const doc = await carregarPdf(bytes);
  doc.setTitle(titulo);
  return doc.save();
}

/** Junta as partes, na ordem recebida, em um único PDF. */
export async function juntarPartes(partes: ParteFonte[], titulo: string): Promise<PdfMontado> {
  const destino = await PDFDocument.create();
  destino.setTitle(titulo);
  const paginas: number[] = [];
  for (const parte of partes) paginas.push(await adicionarParte(destino, parte));
  return { bytes: await destino.save(), paginas };
}

import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { ArquivoInvalidoError, juntarPartes, renomearTituloPdf } from "../../src/lib/contasPdf";

/** PDF com páginas de larguras 100, 101, ... para identificar de onde cada página veio. */
async function pdf(paginas: number, larguraBase = 100): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([larguraBase + i, 200]);
  return doc.save();
}

async function larguras(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

// PNG 1x1 transparente.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("juntarPartes", () => {
  it("puts the boleto pages first, then the comprovante, and counts each part", async () => {
    const boleto = await pdf(2, 100);
    const comprovante = await pdf(1, 300);

    const montado = await juntarPartes(
      [
        { bytes: boleto, type: "application/pdf" },
        { bytes: comprovante, type: "application/pdf" },
      ],
      "BOL_X"
    );

    expect(montado.paginas).toEqual([2, 1]);
    expect(await larguras(montado.bytes)).toEqual([100, 101, 300]);
    expect((await PDFDocument.load(montado.bytes)).getTitle()).toBe("BOL_X");
  });

  it("turns an image into one A4 page", async () => {
    const montado = await juntarPartes([{ bytes: PNG, type: "image/png" }], "BOL_X");
    expect(montado.paginas).toEqual([1]);
    expect(await larguras(montado.bytes)).toEqual([595]);
  });

  it("reuses a page range of an assembled PDF to swap the other part", async () => {
    // PDF atual: boleto (2 págs, 100/101) + comprovante (1 pág, 300); troca o comprovante.
    const atual = await juntarPartes(
      [
        { bytes: await pdf(2, 100), type: "application/pdf" },
        { bytes: await pdf(1, 300), type: "application/pdf" },
      ],
      "BOL_X"
    );
    const novoComprovante = await pdf(2, 500);

    const montado = await juntarPartes(
      [
        { bytes: atual.bytes, type: "application/pdf", paginas: [0, 2] },
        { bytes: novoComprovante, type: "application/pdf" },
      ],
      "BOL_X"
    );

    expect(montado.paginas).toEqual([2, 2]);
    expect(await larguras(montado.bytes)).toEqual([100, 101, 500, 501]);
  });

  it("rejects files that are not readable PDFs or images", async () => {
    await expect(juntarPartes([{ bytes: new TextEncoder().encode("não é pdf"), type: "application/pdf" }], "BOL_X")).rejects.toBeInstanceOf(ArquivoInvalidoError);
    await expect(juntarPartes([{ bytes: new TextEncoder().encode("não é png"), type: "image/png" }], "BOL_X")).rejects.toBeInstanceOf(ArquivoInvalidoError);
  });

  it("retitles a PDF without touching its pages", async () => {
    const montado = await juntarPartes([{ bytes: await pdf(2, 100), type: "application/pdf" }], "BOL_ANTIGO");
    const renomeado = await renomearTituloPdf(montado.bytes, "BOL_NOVO");
    expect((await PDFDocument.load(renomeado)).getTitle()).toBe("BOL_NOVO");
    expect(await larguras(renomeado)).toEqual([100, 101]);
  });
});

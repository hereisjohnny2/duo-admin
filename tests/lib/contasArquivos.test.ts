import { describe, expect, it } from "vitest";

import { contaPdfPath } from "../../src/lib/contasStorage";
import { CONTA_ARQUIVO_MAX_BYTES, contaParteUrl, contaPdfUrl, isContaArquivoTipo, nomePdfConta, validateContaArquivo } from "../../src/lib/contasCompute";

describe("conta file attachments", () => {
  it("only knows the boleto and comprovante slots", () => {
    expect(isContaArquivoTipo("boleto")).toBe(true);
    expect(isContaArquivoTipo("comprovante")).toBe(true);
    expect(isContaArquivoTipo("nota")).toBe(false);
  });

  it("accepts PDFs and PNG/JPG images up to the size limit", () => {
    expect(validateContaArquivo({ size: 1024, type: "application/pdf" })).toBeNull();
    expect(validateContaArquivo({ size: CONTA_ARQUIVO_MAX_BYTES, type: "image/jpeg" })).toBeNull();
    expect(validateContaArquivo({ size: 10, type: "image/png" })).toBeNull();
  });

  it("rejects empty, oversized and unsupported files", () => {
    expect(validateContaArquivo({ size: 0, type: "application/pdf" })).toMatch(/vazio/);
    expect(validateContaArquivo({ size: CONTA_ARQUIVO_MAX_BYTES + 1, type: "application/pdf" })).toMatch(/8 MB/);
    expect(validateContaArquivo({ size: 10, type: "application/zip" })).toMatch(/PDF/);
    // O pdf-lib não embute WEBP no PDF.
    expect(validateContaArquivo({ size: 10, type: "image/webp" })).toMatch(/PNG ou JPG/);
  });

  it("points at the API routes for the PDF and for each part", () => {
    expect(contaPdfUrl("abc")).toBe("/api/contas/abc/arquivos");
    expect(contaParteUrl("abc", "boleto")).toBe("/api/contas/abc/arquivos/boleto");
  });

  it("keeps the PDF name and puts each version in its own folder under the conta", () => {
    const a = contaPdfPath("conta-1", "BOL_IPTU_X_04_2026.pdf");
    const b = contaPdfPath("conta-1", "BOL_IPTU_X_04_2026.pdf");
    expect(a).toMatch(/^conta-1\/[0-9a-f-]{36}\/BOL_IPTU_X_04_2026\.pdf$/);
    expect(a).not.toBe(b);
  });
});

describe("nomePdfConta", () => {
  const conta = { categoria: "IPTU", beneficiario: "Prefeitura", identificacao: "Casa 2", vencimento: "2026-04-10" };

  it("follows BOL_<Categoria>_<Beneficiario>+<Identificacao>_<Mes>_<Ano>.pdf", () => {
    expect(nomePdfConta(conta)).toBe("BOL_IPTU_Prefeitura+Casa-2_04_2026.pdf");
  });

  it("drops accents and characters the Storage does not accept", () => {
    expect(
      nomePdfConta({ categoria: "Água", beneficiario: "CACHOEIRA DE MACACU, QD 20, LT 11", identificacao: "Matrícula nº 7/B", vencimento: "2026-12-01" })
    ).toBe("BOL_Agua_CACHOEIRA-DE-MACACU-QD-20-LT-11+Matricula-no-7-B_12_2026.pdf");
  });

  it("uses the COMP prefix for a comprovante on its own", () => {
    expect(nomePdfConta(conta, "COMP")).toBe("COMP_IPTU_Prefeitura+Casa-2_04_2026.pdf");
  });

  it("omits the identificação part when it is empty", () => {
    expect(nomePdfConta({ ...conta, identificacao: "  " })).toBe("BOL_IPTU_Prefeitura_04_2026.pdf");
  });

  it("has no name without a valid vencimento", () => {
    expect(nomePdfConta({ ...conta, vencimento: "" })).toBeNull();
    expect(nomePdfConta({ ...conta, vencimento: "10/04/2026" })).toBeNull();
  });
});

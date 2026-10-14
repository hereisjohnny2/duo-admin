import { describe, expect, it } from "vitest";

import { contaArquivoPath } from "../../src/lib/contasStorage";
import { CONTA_ARQUIVO_MAX_BYTES, contaArquivoUrl, isContaArquivoTipo, validateContaArquivo } from "../../src/lib/contasCompute";

describe("conta file attachments", () => {
  it("only knows the boleto and comprovante slots", () => {
    expect(isContaArquivoTipo("boleto")).toBe(true);
    expect(isContaArquivoTipo("comprovante")).toBe(true);
    expect(isContaArquivoTipo("nota")).toBe(false);
  });

  it("accepts PDFs and images up to the size limit", () => {
    expect(validateContaArquivo({ size: 1024, type: "application/pdf" })).toBeNull();
    expect(validateContaArquivo({ size: CONTA_ARQUIVO_MAX_BYTES, type: "image/jpeg" })).toBeNull();
  });

  it("rejects empty, oversized and unsupported files", () => {
    expect(validateContaArquivo({ size: 0, type: "application/pdf" })).toMatch(/vazio/);
    expect(validateContaArquivo({ size: CONTA_ARQUIVO_MAX_BYTES + 1, type: "application/pdf" })).toMatch(/8 MB/);
    expect(validateContaArquivo({ size: 10, type: "application/zip" })).toMatch(/PDF/);
  });

  it("points at the API route that serves the file", () => {
    expect(contaArquivoUrl("abc", "boleto")).toBe("/api/contas/abc/arquivos/boleto");
  });

  it("stores each upload under the conta with a unique name and the original extension", () => {
    const a = contaArquivoPath("conta-1", "boleto", "Boleto Março.PDF");
    const b = contaArquivoPath("conta-1", "boleto", "Boleto Março.PDF");
    expect(a).toMatch(/^conta-1\/boleto-[0-9a-f-]{36}\.pdf$/);
    expect(a).not.toBe(b);
    expect(contaArquivoPath("conta-1", "comprovante", "sem-extensao")).toMatch(/^conta-1\/comprovante-[0-9a-f-]{36}$/);
  });
});

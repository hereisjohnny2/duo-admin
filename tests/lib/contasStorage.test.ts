import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

import type { Conta } from "../../src/lib/types";
import type { ContaPdfRow } from "../../src/lib/db";

/* Bucket do Storage em memória e banco simulado: só setContaPdf é usado aqui. */
const objetos = new Map<string, Uint8Array>();
let linha: (ContaPdfRow & { existe: boolean }) | null = null;

const bucket = {
  upload: async (path: string, bytes: Uint8Array) => {
    objetos.set(path, bytes);
    return { error: null };
  },
  download: async (path: string) => {
    const bytes = objetos.get(path);
    return bytes ? { data: new Blob([new Uint8Array(bytes)]), error: null } : { data: null, error: { message: "Object not found", status: 404 } };
  },
  remove: async (paths: string[]) => {
    for (const p of paths) objetos.delete(p);
    return { error: null };
  },
};

vi.mock("../../src/lib/supabase", () => ({ getServerSupabase: () => ({ storage: { from: () => bucket } }) }));
vi.mock("../../src/lib/db", () => ({
  setContaPdf: async (id: string, row: ContaPdfRow) => {
    if (!linha?.existe) return null;
    linha = { ...row, existe: true };
    return conta(id);
  },
}));

const base = { categoria: "IPTU", beneficiario: "Prefeitura", identificacao: "Casa 2", vencimento: "2026-04-10" };

/** Conta como o banco devolveria, a partir da linha simulada. */
function conta(id = "c1", campos: Partial<typeof base> = {}): Conta {
  const arquivo = (path: string) => (path ? { path, nome: path.slice(path.lastIndexOf("/") + 1) } : null);
  const parte = (p: ContaPdfRow["boleto"]) => (p ? { nome: p.nome, paginas: p.paginas, arquivo: arquivo(p.path) } : null);
  return {
    id,
    ...base,
    ...campos,
    dataDebito: "",
    saida: "",
    status: "Em Aberto",
    observacoes: "",
    boleto: parte(linha?.boleto ?? null),
    comprovante: parte(linha?.comprovante ?? null),
    pdf: arquivo(linha?.pdfPath ?? ""),
  };
}

async function pdf(paginas: number, largura: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([largura + i, 200]);
  return (await doc.save()).slice().buffer;
}

async function larguras(path: string): Promise<number[]> {
  const doc = await PDFDocument.load(objetos.get(path)!);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

const nomes = () => [...objetos.keys()].map((p) => p.slice(p.lastIndexOf("/") + 1)).sort();

describe("contasStorage", () => {
  beforeEach(() => {
    objetos.clear();
    linha = { pdfPath: "", boleto: null, comprovante: null, existe: true };
  });

  it("saves each part as its own file, BOL_ for the boleto and COMP_ for the comprovante", async () => {
    const { salvarParteConta } = await import("../../src/lib/contasStorage");

    const soComprovante = await salvarParteConta(conta(), "comprovante", { nome: "pix.pdf", type: "application/pdf", bytes: await pdf(1, 300) });
    expect(soComprovante?.comprovante?.arquivo?.nome).toBe("COMP_IPTU_Prefeitura+Casa-2_04_2026.pdf");
    expect(soComprovante?.pdf).toBeNull();

    const comBoleto = await salvarParteConta(conta(), "boleto", { nome: "boleto.pdf", type: "application/pdf", bytes: await pdf(2, 100) });
    expect(comBoleto?.boleto).toMatchObject({ nome: "boleto.pdf", paginas: 2, arquivo: { nome: "BOL_IPTU_Prefeitura+Casa-2_04_2026.pdf" } });
    expect(nomes()).toEqual(["BOL_IPTU_Prefeitura+Casa-2_04_2026.pdf", "COMP_IPTU_Prefeitura+Casa-2_04_2026.pdf"]);
    expect([...objetos.keys()].every((p) => p.startsWith("2026/04 - Abril/"))).toBe(true);
  });

  it("replacing a separate part deletes only its old file", async () => {
    const { salvarParteConta } = await import("../../src/lib/contasStorage");
    await salvarParteConta(conta(), "boleto", { nome: "a.pdf", type: "application/pdf", bytes: await pdf(1, 100) });
    const antigo = conta().boleto!.arquivo!.path;

    await salvarParteConta(conta(), "boleto", { nome: "b.pdf", type: "application/pdf", bytes: await pdf(3, 400) });

    expect(objetos.has(antigo)).toBe(false);
    expect(objetos.size).toBe(1);
    expect(await larguras(conta().boleto!.arquivo!.path)).toEqual([400, 401, 402]);
  });

  it("only joins when both parts are attached, then keeps just the BOL_ file", async () => {
    const { juntarConta, salvarParteConta } = await import("../../src/lib/contasStorage");
    await salvarParteConta(conta(), "boleto", { nome: "boleto.pdf", type: "application/pdf", bytes: await pdf(2, 100) });
    await expect(juntarConta(conta())).rejects.toThrow(/boleto e o comprovante/);

    await salvarParteConta(conta(), "comprovante", { nome: "pix.pdf", type: "application/pdf", bytes: await pdf(1, 300) });
    const juntada = await juntarConta(conta());

    expect(juntada?.pdf?.nome).toBe("BOL_IPTU_Prefeitura+Casa-2_04_2026.pdf");
    expect(juntada?.boleto).toEqual({ nome: "boleto.pdf", paginas: 2, arquivo: null });
    expect(juntada?.comprovante).toEqual({ nome: "pix.pdf", paginas: 1, arquivo: null });
    expect(objetos.size).toBe(1);
    expect(await larguras(juntada!.pdf!.path)).toEqual([100, 101, 300]);
    await expect(juntarConta(conta())).rejects.toThrow(/já estão juntos/);
  });

  it("replacing a part of a joined PDF splits it back into separate files", async () => {
    const { juntarConta, salvarParteConta } = await import("../../src/lib/contasStorage");
    await salvarParteConta(conta(), "boleto", { nome: "boleto.pdf", type: "application/pdf", bytes: await pdf(2, 100) });
    await salvarParteConta(conta(), "comprovante", { nome: "pix.pdf", type: "application/pdf", bytes: await pdf(1, 300) });
    await juntarConta(conta());

    const separada = await salvarParteConta(conta(), "comprovante", { nome: "novo.pdf", type: "application/pdf", bytes: await pdf(1, 500) });

    expect(separada?.pdf).toBeNull();
    expect(nomes()).toEqual(["BOL_IPTU_Prefeitura+Casa-2_04_2026.pdf", "COMP_IPTU_Prefeitura+Casa-2_04_2026.pdf"]);
    expect(await larguras(separada!.boleto!.arquivo!.path)).toEqual([100, 101]);
    expect(await larguras(separada!.comprovante!.arquivo!.path)).toEqual([500]);
  });

  it("removing a part of a joined PDF leaves the other one on its own", async () => {
    const { juntarConta, salvarParteConta } = await import("../../src/lib/contasStorage");
    await salvarParteConta(conta(), "boleto", { nome: "boleto.pdf", type: "application/pdf", bytes: await pdf(2, 100) });
    await salvarParteConta(conta(), "comprovante", { nome: "pix.pdf", type: "application/pdf", bytes: await pdf(1, 300) });
    await juntarConta(conta());

    const semBoleto = await salvarParteConta(conta(), "boleto", null);

    expect(semBoleto?.boleto).toBeNull();
    expect(semBoleto?.pdf).toBeNull();
    expect(nomes()).toEqual(["COMP_IPTU_Prefeitura+Casa-2_04_2026.pdf"]);
    expect(await larguras(semBoleto!.comprovante!.arquivo!.path)).toEqual([300]);
  });

  it("renames every file when the conta changes", async () => {
    const { renomearPdfConta, salvarParteConta } = await import("../../src/lib/contasStorage");
    await salvarParteConta(conta(), "boleto", { nome: "boleto.pdf", type: "application/pdf", bytes: await pdf(1, 100) });
    await salvarParteConta(conta(), "comprovante", { nome: "pix.pdf", type: "application/pdf", bytes: await pdf(1, 300) });

    await renomearPdfConta(conta("c1", { vencimento: "2026-05-10" }));

    expect(nomes()).toEqual(["BOL_IPTU_Prefeitura+Casa-2_05_2026.pdf", "COMP_IPTU_Prefeitura+Casa-2_05_2026.pdf"]);
    // Mudou de mês: os arquivos vão para a pasta do novo mês no Storage.
    expect([...objetos.keys()].every((p) => p.startsWith("2026/05 - Maio/"))).toBe(true);
    const doc = await PDFDocument.load(objetos.get(conta().comprovante!.arquivo!.path)!);
    expect(doc.getTitle()).toBe("COMP_IPTU_Prefeitura+Casa-2_05_2026");
  });

  it("does not leave uploaded files behind when the conta disappears midway", async () => {
    const { salvarParteConta } = await import("../../src/lib/contasStorage");
    linha = { pdfPath: "", boleto: null, comprovante: null, existe: false };

    await expect(salvarParteConta(conta(), "boleto", { nome: "b.pdf", type: "application/pdf", bytes: await pdf(1, 100) })).resolves.toBeNull();
    expect(objetos.size).toBe(0);
  });
});

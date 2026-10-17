import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BACKUP_TABELAS, exportarBackup, linhasParaCsv, pastaDoDia, pastasExpiradas } from "../../src/lib/backup";

describe("linhasParaCsv", () => {
  it("uses the house format: BOM, ';' separator and CRLF", () => {
    const csv = linhasParaCsv([
      { id: "1", nome: "Água", valor: 10 },
      { id: "2", nome: "Luz", valor: 20 },
    ]);
    expect(csv).toBe("﻿id;nome;valor\r\n1;Água;10\r\n2;Luz;20");
  });

  it("quotes values with separators, quotes or line breaks, and blanks nulls", () => {
    const csv = linhasParaCsv([{ a: 'diz "oi"; tchau', b: "linha 1\nlinha 2", c: null, d: true }]);
    expect(csv).toBe('﻿a;b;c;d\r\n"diz ""oi""; tchau";"linha 1\nlinha 2";;true');
  });

  it("keeps every column even when rows differ, and serializes objects as JSON", () => {
    const csv = linhasParaCsv([{ a: 1 }, { a: 2, b: { x: 1 } }]);
    expect(csv).toBe('﻿a;b\r\n1;\r\n2;"{""x"":1}"');
  });
});

describe("folders", () => {
  it("names the folder by the date in Brasília, not UTC", () => {
    // Domingo 06:00 UTC = 03:00 em Brasília; e 02:00 UTC ainda é o dia anterior lá.
    expect(pastaDoDia(new Date("2026-10-18T06:00:00Z"))).toBe("2026-10-18");
    expect(pastaDoDia(new Date("2026-10-18T02:00:00Z"))).toBe("2026-10-17");
  });

  it("expires only dated folders older than 30 days", () => {
    const hoje = new Date("2026-10-18T06:00:00Z");
    expect(pastasExpiradas(["2026-09-17", "2026-09-18", "2026-10-11", "outra-coisa"], hoje)).toEqual(["2026-09-17"]);
  });
});

/** Supabase simulado: tabelas em memória (com paginação por range) e um bucket. */
function fakeSupabase(tabelas: Record<string, Record<string, unknown>[]>, arquivos: Map<string, string>) {
  const query = (tabela: string) => ({
    select: () => ({
      order: () => ({
        range: async (de: number, ate: number) => ({ data: (tabelas[tabela] ?? []).slice(de, ate + 1), error: null }),
      }),
    }),
  });
  const bucket = {
    upload: async (path: string, body: string) => {
      arquivos.set(path, body);
      return { error: null };
    },
    list: async (pasta: string) => {
      const prefixo = pasta ? `${pasta}/` : "";
      const nomes = new Set(
        [...arquivos.keys()].filter((p) => p.startsWith(prefixo)).map((p) => p.slice(prefixo.length).split("/")[0])
      );
      return { data: [...nomes].map((name) => ({ name })), error: null };
    },
    remove: async (paths: string[]) => {
      for (const p of paths) arquivos.delete(p);
      return { error: null };
    },
  };
  return { from: query, storage: { from: () => bucket } } as unknown as SupabaseClient;
}

describe("exportarBackup", () => {
  it("writes one CSV per table in today's folder and drops folders older than 30 days", async () => {
    const contas = Array.from({ length: 2500 }, (_, i) => ({ id: String(i).padStart(4, "0"), beneficiario: `B${i}` }));
    const arquivos = new Map<string, string>([
      ["2026-09-01/contas.csv", "velho"],
      ["2026-09-01/acordos.csv", "velho"],
      ["2026-10-11/contas.csv", "recente"],
    ]);
    const supabase = fakeSupabase({ contas, categorias: [{ id: "c", nome: "IPTU" }] }, arquivos);

    const resultado = await exportarBackup(supabase, new Date("2026-10-18T06:00:00Z"));

    expect(resultado.pasta).toBe("2026-10-18");
    expect(resultado.tabelas.map((t) => t.tabela)).toEqual([...BACKUP_TABELAS]);
    // Mais de uma página (1000 linhas por consulta): todas as linhas entram.
    expect(resultado.tabelas.find((t) => t.tabela === "contas")?.linhas).toBe(2500);
    expect(arquivos.get("2026-10-18/contas.csv")!.split("\r\n")).toHaveLength(2501);
    expect(arquivos.get("2026-10-18/categorias.csv")).toBe("﻿id;nome\r\nc;IPTU");

    expect(resultado.apagadas).toEqual(["2026-09-01"]);
    expect(arquivos.has("2026-09-01/contas.csv")).toBe(false);
    expect(arquivos.has("2026-10-11/contas.csv")).toBe(true);
  });
});

describe("GET /api/cron/backup", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    vi.doUnmock("@/lib/backup");
    vi.doUnmock("@/lib/supabase");
  });

  async function rota() {
    const exportar = vi.fn(async () => ({ pasta: "2026-10-18", tabelas: [], apagadas: [] }));
    vi.doMock("@/lib/backup", () => ({ exportarBackup: exportar }));
    vi.doMock("@/lib/supabase", () => ({ getServerSupabase: () => ({}) }));
    const { GET } = await import("../../src/app/api/cron/backup/route");
    const chamar = (auth?: string) => GET(new Request("http://localhost/api/cron/backup", { headers: auth ? { authorization: auth } : {} }));
    return { chamar, exportar };
  }

  it("refuses to run without CRON_SECRET configured", async () => {
    const { chamar, exportar } = await rota();
    expect((await chamar("Bearer qualquer")).status).toBe(500);
    expect(exportar).not.toHaveBeenCalled();
  });

  it("only runs with the right secret", async () => {
    process.env.CRON_SECRET = "segredo-certo";
    const { chamar, exportar } = await rota();

    expect((await chamar()).status).toBe(401);
    expect((await chamar("Bearer errado")).status).toBe(401);
    expect(exportar).not.toHaveBeenCalled();

    const ok = await chamar("Bearer segredo-certo");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ pasta: "2026-10-18", tabelas: [], apagadas: [] });
    expect(exportar).toHaveBeenCalledTimes(1);
  });
});

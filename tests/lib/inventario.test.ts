import { describe, expect, it } from "vitest";

import { CATEGORIAS, clampQtd, fmtQtd, nextCodigo, statusOf, summarize, toCSV } from "../../src/lib/inventario";
import type { InventarioItem } from "../../src/lib/types";

function item(partial: Partial<InventarioItem>): InventarioItem {
  return {
    id: partial.id ?? "id",
    codigo: partial.codigo ?? "HID-001",
    produto: partial.produto ?? "Produto",
    categoria: partial.categoria ?? "Hidráulica",
    quantidade: partial.quantidade ?? 1,
    unidade: partial.unidade ?? "un",
    estoqueMinimo: partial.estoqueMinimo ?? 1,
    localizacao: partial.localizacao ?? "",
    observacoes: partial.observacoes ?? "",
  };
}

describe("inventario utilities", () => {
  it("derives the status from quantity and minimum stock", () => {
    expect(statusOf({ quantidade: 0, estoqueMinimo: 1 })).toBe("ZERADO");
    expect(statusOf({ quantidade: 1, estoqueMinimo: 1 })).toBe("REPOR");
    expect(statusOf({ quantidade: 2, estoqueMinimo: 1 })).toBe("OK");
    // Sem estoque mínimo, qualquer saldo positivo já é OK.
    expect(statusOf({ quantidade: 0.5, estoqueMinimo: 0 })).toBe("OK");
  });

  it("keeps quantities non-negative and rounded to 2 decimals", () => {
    expect(clampQtd(-3)).toBe(0);
    expect(clampQtd(8.505)).toBe(8.51);
    expect(clampQtd(Number("nao é número"))).toBe(0);
  });

  it("formats quantities with the Brazilian decimal comma", () => {
    expect(fmtQtd(8.5)).toBe("8,5");
    expect(fmtQtd(12)).toBe("12");
  });

  it("generates the next code for a category, ignoring other categories", () => {
    expect(nextCodigo("Hidráulica", ["HID-001", "HID-007", "ACB-099"])).toBe("HID-008");
    expect(nextCodigo("Concreto", [])).toBe("CCR-001");
    expect(() => nextCodigo("Inexistente", [])).toThrow();
  });

  it("exposes every category sorted in Brazilian Portuguese", () => {
    expect(CATEGORIAS).toContain("Elétrica");
    expect([...CATEGORIAS].sort((a, b) => a.localeCompare(b, "pt"))).toEqual(CATEGORIAS);
  });

  it("summarizes counts by status and category", () => {
    const summary = summarize([
      item({ id: "1", quantidade: 5, estoqueMinimo: 1 }),
      item({ id: "2", quantidade: 1, estoqueMinimo: 1 }),
      item({ id: "3", quantidade: 0, estoqueMinimo: 1 }),
      item({ id: "4", categoria: "EPI", quantidade: 9, estoqueMinimo: 1 }),
    ]);

    expect(summary).toMatchObject({ total: 4, ok: 2, repor: 1, zerado: 1 });
    expect(summary.byCategoria).toEqual([
      { name: "Hidráulica", n: 3 },
      { name: "EPI", n: 1 },
    ]);
  });

  it("escapes separators and quotes when exporting the CSV", () => {
    const csv = toCSV([item({ produto: 'Cano "Y"; 50mm', quantidade: 8.5, localizacao: "A3" })]);
    const [head, row] = csv.split("\r\n");

    expect(head.startsWith("﻿Código;Produto")).toBe(true);
    expect(row).toContain('"Cano ""Y""; 50mm"');
    expect(row).toContain(";8,5;");
    expect(row).toContain(";OK;A3;");
  });
});

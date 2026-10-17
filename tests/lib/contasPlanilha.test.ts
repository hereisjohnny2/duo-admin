import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { fmt } from "../../src/lib/compute";
import { anoDoArquivo, chaveConta, lerPlanilhaContas, nomeCategoria, separarDuplicadas } from "../../src/lib/contasPlanilha";
import { lerXlsx, serialParaIso } from "../../src/lib/xlsx";
import { aba, serial, xlsx } from "../helpers/xlsx";

const CATEGORIAS = ["Água", "Energia", "Caixinha", "IPTU"];

describe("leitor de xlsx", () => {
  it("lê textos e números de cada aba e converte o serial de data", () => {
    const pasta = lerXlsx(xlsx({ A: [["oi", 1.5]], B: [[null, "x"]] }));
    expect(pasta.abas.map((a) => a.nome)).toEqual(["A", "B"]);
    expect(pasta.abas[0].linhas[0]).toEqual(["oi", 1.5]);
    expect(pasta.abas[1].linhas[0]).toEqual([null, "x"]);
    expect(serialParaIso(serial("2026-01-28"))).toBe("2026-01-28");
  });

  it("recusa arquivos que não são xlsx", () => {
    expect(() => lerXlsx(strToU8("não é zip"))).toThrow(/xlsx/);
  });
});

describe("importar contas da planilha", () => {
  const planilha = xlsx({
    JAN: aba("JANEIRO", [
      ["ÁGUA", "RIO+SANEAMENTO", "VIVERDE - LOTE 187", serial("2026-01-28"), "-", 264.22, "-", "PAGO", "DÉBITO AUTOMÁTICO"],
      ["ENERGIA", "ENEL", "BOMBA", serial("2026-01-01"), "09//01/2026", "?", "-", "EM ABERTO", null],
      ["         ", null, null, null, null, null, null, null, null],
      ["IPTU", "PREFEITURA", "CASA", "31/04/2026", null, 100, null, "ATRASADO", null],
    ]),
    JUL: aba("JULHO", [["CAIXINHA", "DENISE", "ESCRITÓRIO", "-", serial("2026-06-30"), 250, null, "PAGO", "CAIXINHA DE JULHO"]]),
    NOV: aba("NOVEMBRO", [["MULTA DARF", "RECEITA", "", serial("2026-11-10"), null, 50, null, null, null]]),
    TABELAS: [["MÊS", "Nº CORRESPONDENTE"], ["JANEIRO", 1]],
  });

  const abas = lerPlanilhaContas(planilha, { anoPadrao: 2026, categorias: CATEGORIAS });

  it("lê uma aba por mês e ignora as que não seguem o modelo", () => {
    expect(abas.map((a) => [a.aba, a.mes, a.contas.length])).toEqual([
      ["JAN", "2026-01", 3],
      ["JUL", "2026-07", 1],
      ["NOV", "2026-11", 1],
    ]);
  });

  it("converte cada linha em conta", () => {
    expect(abas[0].contas[0]).toEqual({
      categoria: "Água",
      beneficiario: "RIO+SANEAMENTO",
      identificacao: "VIVERDE - LOTE 187",
      vencimento: "2026-01-28",
      dataDebito: "",
      saida: fmt(264.22), // mesmo formato das contas criadas no app
      status: "Pago",
      observacoes: "DÉBITO AUTOMÁTICO",
    });
    // "?" = sem valor; "09//01/2026" é erro de digitação de data.
    expect(abas[0].contas[1]).toMatchObject({ categoria: "Energia", saida: "", dataDebito: "2026-01-09", status: "Em Aberto" });
  });

  it("ajusta datas impossíveis e põe sem vencimento no dia 1º do mês da aba", () => {
    expect(abas[0].contas[2]).toMatchObject({ vencimento: "2026-04-30", status: "Atrasado" });
    expect(abas[1].contas[0]).toMatchObject({ categoria: "Caixinha", vencimento: "2026-07-01", dataDebito: "2026-06-30" });
  });

  it("usa a categoria já cadastrada ou, se for nova, o nome da planilha", () => {
    expect(abas[2].contas[0].categoria).toBe("MULTA DARF");
    expect(nomeCategoria("agua", CATEGORIAS)).toBe("Água");
    expect(nomeCategoria(" iptu ", CATEGORIAS)).toBe("IPTU");
  });

  it("pega o ano do nome do arquivo", () => {
    expect(anoDoArquivo("CTR03.R00_FINANCEIRO_2026.xlsx")).toBe(2026);
  });
});

describe("contas que já existem", () => {
  const base = { beneficiario: "RIO+SANEAMENTO", identificacao: "Viverde - Lote 187", saida: "R$ 264,22", vencimento: "2026-01-05", dataDebito: "" };

  it("são as de mesmo nome, valor e mês/ano (sem diferenciar acentos e maiúsculas)", () => {
    expect(chaveConta({ ...base, beneficiario: "rio+saneamento", vencimento: "2026-01-28" })).toBe(chaveConta(base));
    expect(chaveConta({ ...base, saida: "R$ 264,23" })).not.toBe(chaveConta(base));
    expect(chaveConta({ ...base, vencimento: "2026-02-05" })).not.toBe(chaveConta(base));
    expect(chaveConta({ ...base, vencimento: "2025-01-05" })).not.toBe(chaveConta(base));
    expect(chaveConta({ ...base, identificacao: "Rua das Laranjeiras" })).not.toBe(chaveConta(base));
  });

  it("ficam de fora da importação", () => {
    const planilha = [
      { ...base, saida: "R$ 264,22" },
      { ...base, saida: "R$ 300,00" },
    ];
    const { novas, duplicadas } = separarDuplicadas(planilha, [{ ...base, saida: "264,22", dataDebito: "" }]);
    expect(novas).toEqual([planilha[1]]);
    expect(duplicadas).toEqual([planilha[0]]);
  });

  it("sem vencimento casam só com uma linha de mesmo nome, valor e data de débito", () => {
    const caixinha = { beneficiario: "DENISE", identificacao: "ESCRITÓRIO", saida: "R$ 250,00" };
    const planilha = [
      { ...caixinha, vencimento: "2026-07-01", dataDebito: "2026-06-30" },
      { ...caixinha, vencimento: "2026-08-01", dataDebito: "2026-06-30" },
      { ...caixinha, vencimento: "2026-09-01", dataDebito: "2026-09-01" },
    ];
    const { novas, duplicadas } = separarDuplicadas(planilha, [{ ...caixinha, vencimento: "", dataDebito: "2026-06-30" }]);
    expect(duplicadas).toEqual([planilha[0]]);
    expect(novas).toEqual(planilha.slice(1));
  });
});

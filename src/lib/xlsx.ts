import { strFromU8, unzipSync } from "fflate";

/* =====================================================================
   Leitor mínimo de .xlsx — só o necessário para importar planilhas:
   nome das abas e o valor de cada célula (texto, número ou booleano).
   Datas chegam como o número serial do Excel; converta com serialParaIso.
   Usa DOMParser, então roda no browser (e no jsdom dos testes).
   ===================================================================== */

export type XlsxCelula = string | number | boolean | null;

export interface XlsxAba {
  nome: string;
  /** linhas[linha][coluna], ambos a partir de 0 (A1 = linhas[0][0]). Linhas vazias ficam como []. */
  linhas: XlsxCelula[][];
}

export interface XlsxPasta {
  abas: XlsxAba[];
  /** Pasta no sistema de datas de 1904 (planilhas antigas do Mac). */
  data1904: boolean;
}

export class XlsxInvalidoError extends Error {}

const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xml(arquivos: Record<string, Uint8Array>, caminho: string): Document | null {
  const bytes = arquivos[caminho];
  if (!bytes) return null;
  return new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
}

const porTag = (el: Document | Element, tag: string) => Array.from(el.getElementsByTagNameNS("*", tag));

/** Texto de um <si>/<is>: junta os <t> (também os de rich text), ignorando a fonética (<rPh>). */
function textoRico(el: Element): string {
  return porTag(el, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

/** "AB12" -> 27 (índice da coluna a partir de 0). */
function indiceColuna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Caminho do arquivo da aba dentro do zip, a partir do Target das relações de workbook.xml. */
function caminhoAba(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target}`.replace(/\/\.\//g, "/");
}

export function lerXlsx(bytes: Uint8Array): XlsxPasta {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(bytes);
  } catch {
    throw new XlsxInvalidoError("O arquivo não é uma planilha .xlsx válida.");
  }

  const workbook = xml(arquivos, "xl/workbook.xml");
  if (!workbook) throw new XlsxInvalidoError("O arquivo não é uma planilha .xlsx válida.");

  const rels = new Map<string, string>();
  for (const r of porTag(xml(arquivos, "xl/_rels/workbook.xml.rels") ?? workbook, "Relationship")) {
    rels.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  }

  const compartilhados = porTag(xml(arquivos, "xl/sharedStrings.xml") ?? workbook, "si").map(textoRico);
  const props = porTag(workbook, "workbookPr")[0];
  const data1904 = props?.getAttribute("date1904") === "1" || props?.getAttribute("date1904") === "true";

  const abas: XlsxAba[] = [];
  for (const sheet of porTag(workbook, "sheet")) {
    const nome = sheet.getAttribute("name") ?? "";
    const target = rels.get(sheet.getAttributeNS(NS_REL, "id") ?? sheet.getAttribute("r:id") ?? "");
    const doc = target ? xml(arquivos, caminhoAba(target)) : null;
    if (!doc) continue;

    const linhas: XlsxCelula[][] = [];
    for (const row of porTag(doc, "row")) {
      const r = Number(row.getAttribute("r")) - 1;
      if (!(r >= 0)) continue;
      const linha: XlsxCelula[] = [];
      for (const c of porTag(row, "c")) {
        const col = indiceColuna(c.getAttribute("r") ?? "");
        if (col < 0) continue;
        const tipo = c.getAttribute("t");
        const v = porTag(c, "v")[0]?.textContent ?? null;
        let valor: XlsxCelula = null;
        if (tipo === "s") valor = v == null ? null : (compartilhados[Number(v)] ?? null);
        else if (tipo === "inlineStr") valor = porTag(c, "is")[0] ? textoRico(porTag(c, "is")[0]) : null;
        else if (tipo === "str") valor = v;
        else if (tipo === "b") valor = v == null ? null : v === "1";
        else if (tipo === "e") valor = null; // #N/A, #REF! etc.
        else if (v != null && v !== "") valor = Number(v);
        linha[col] = valor;
      }
      linhas[r] = Array.from(linha, (x) => x ?? null);
    }
    abas.push({ nome, linhas: Array.from(linhas, (l) => l ?? []) });
  }

  return { abas, data1904 };
}

/** Número serial de data do Excel -> "yyyy-mm-dd" (a parte de horas é descartada). */
export function serialParaIso(serial: number, data1904 = false): string {
  // Base 1899-12-30 já compensa o 29/02/1900 que o Excel considera existir.
  const base = data1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

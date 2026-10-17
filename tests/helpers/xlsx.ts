import { strToU8, zipSync } from "fflate";

/* Planilhas .xlsx montadas em memória para os testes do "Importar da planilha". */

export type Celula = string | number | null;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const coluna = (i: number) => String.fromCharCode(65 + i);

/** Monta um .xlsx mínimo: textos vão para sharedStrings, números ficam na célula. */
export function xlsx(abas: Record<string, Celula[][]>): Uint8Array {
  const strings: string[] = [];
  const sheets: Record<string, Uint8Array> = {};
  Object.entries(abas).forEach(([, linhas], i) => {
    const rows = linhas
      .map((linha, r) => {
        const cells = linha
          .map((v, c) => {
            const ref = `${coluna(c)}${r + 1}`;
            if (v == null) return "";
            if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
            strings.push(v);
            return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    sheets[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
    );
  });
  const nomes = Object.keys(abas);
  return zipSync({
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes
        .map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}</Relationships>`
    ),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`
    ),
    ...sheets,
  });
}

const CABECALHO = ["CATEGORIA", "BENEFICIÁRIO", "IDENTIFICAÇÃO", "VENCIMENTO", "DATA DE DÉBITO", "SAÍDAS", "ENTRADAS", "STATUS", "OBSERVAÇÕES"];

/** Serial do Excel para uma data (o inverso de serialParaIso). */
export const serial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

export const aba = (mes: string, linhas: Celula[][]): Celula[][] => [["MÊS CORRENTE:", mes], [], CABECALHO, ...linhas];

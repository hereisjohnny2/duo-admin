/* =====================================================================
   Funções puras — compartilhadas por cliente e servidor.
   NÃO importar nada de node aqui (este módulo roda no browser).
   ===================================================================== */

/** "R$ 15.000,00" | "15000" | "1.500,50" -> Number (ou null). */
export function parseBRL(s?: string | null): number | null {
  if (s == null || s === "") return null;
  const str = String(s);
  if (!/\d/.test(str)) return null;
  const m = str.match(/-?\d[\d.]*(?:,\d{1,2})?/);
  if (!m) return null;
  let t = m[0];
  t = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\./g, "");
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

/** Reformata "15000" -> "R$ 15.000,00"; mantém textos livres intactos. */
export function normalizeMoney(s?: string | null): string {
  const str = String(s ?? "").trim();
  if (str === "") return "";
  if (/^R?\$?\s*\d[\d.]*(?:,\d{1,2})?$/.test(str)) {
    const n = parseBRL(str);
    if (n != null) return fmt(n);
  }
  return str;
}

export function fmt(n: number): string {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

import type { SupabaseClient } from "@supabase/supabase-js";

/* =====================================================================
   Exportação semanal das tabelas do app em CSV (Vercel Cron ->
   /api/cron/backup). Cada execução grava "<aaaa-mm-dd>/<tabela>.csv" no
   bucket privado "backups" e apaga as pastas com mais de 30 dias.
   Só pode ser importado no servidor.
   ===================================================================== */

export const BACKUP_BUCKET = "backups";
export const BACKUP_RETENCAO_DIAS = 30;

/**
 * Tabelas do app (as internas do Supabase — usuários, storage — ficam de fora).
 * acordos e parcelas são do antigo módulo Débitos: saíram do app, mas os dados continuam no banco.
 */
export const BACKUP_TABELAS = ["acordos", "parcelas", "categorias", "contas", "inventario_itens"] as const;

const PAGINA = 1000; // limite padrão de linhas por consulta do Supabase

type Linha = Record<string, unknown>;

/**
 * CSV no mesmo formato da exportação do inventário: separador ";", BOM e CRLF,
 * para o Excel em português abrir com as colunas e os acentos certos.
 */
export function linhasParaCsv(linhas: Linha[]): string {
  const colunas: string[] = [];
  for (const linha of linhas) for (const k of Object.keys(linha)) if (!colunas.includes(k)) colunas.push(k);

  const valor = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const esc = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const corpo = linhas.map((l) => colunas.map((c) => esc(valor(l[c]))).join(";"));
  return "﻿" + [colunas.map(esc).join(";"), ...corpo].join("\r\n");
}

/** Data no fuso de Brasília, "aaaa-mm-dd" (o cron roda em UTC). */
export function pastaDoDia(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}

/** Pastas "aaaa-mm-dd" mais antigas que `dias` em relação a `hoje`; outros nomes são ignorados. */
export function pastasExpiradas(pastas: string[], hoje: Date, dias = BACKUP_RETENCAO_DIAS): string[] {
  const limite = pastaDoDia(new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000));
  return pastas.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p) && p < limite);
}

/** Todas as linhas da tabela, em páginas (ordenadas pelo id para a paginação ser estável). */
async function lerTabela(supabase: SupabaseClient, tabela: string): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase.from(tabela).select("*").order("id").range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(`Falha ao ler a tabela ${tabela}: ${error.message}`);
    linhas.push(...((data ?? []) as Linha[]));
    if (!data || data.length < PAGINA) return linhas;
  }
}

/** Todos os arquivos dentro de uma pasta do bucket (o list do Storage não é recursivo). */
async function arquivosDaPasta(supabase: SupabaseClient, pasta: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).list(pasta, { limit: 1000 });
  if (error) throw new Error(`Falha ao listar ${pasta}: ${error.message}`);
  return (data ?? []).map((f) => `${pasta}/${f.name}`);
}

export interface ResultadoBackup {
  pasta: string;
  tabelas: { tabela: string; linhas: number }[];
  apagadas: string[];
}

/** Exporta todas as tabelas para a pasta do dia e apaga as exportações expiradas. */
export async function exportarBackup(supabase: SupabaseClient, agora = new Date()): Promise<ResultadoBackup> {
  const bucket = supabase.storage.from(BACKUP_BUCKET);
  const pasta = pastaDoDia(agora);

  const tabelas: ResultadoBackup["tabelas"] = [];
  for (const tabela of BACKUP_TABELAS) {
    const linhas = await lerTabela(supabase, tabela);
    // upsert: rodar de novo no mesmo dia substitui a exportação daquele dia.
    const { error } = await bucket.upload(`${pasta}/${tabela}.csv`, linhasParaCsv(linhas), { contentType: "text/csv", upsert: true });
    if (error) throw new Error(`Falha ao gravar ${tabela}.csv: ${error.message}`);
    tabelas.push({ tabela, linhas: linhas.length });
  }

  // Limpeza só depois de a exportação nova estar completa.
  const { data: raiz, error } = await bucket.list("", { limit: 1000 });
  if (error) throw new Error(`Falha ao listar o bucket de backups: ${error.message}`);
  const apagadas = pastasExpiradas((raiz ?? []).map((p) => p.name), agora);
  for (const antiga of apagadas) {
    const arquivos = await arquivosDaPasta(supabase, antiga);
    if (arquivos.length) {
      const { error: rmError } = await bucket.remove(arquivos);
      if (rmError) throw new Error(`Falha ao apagar ${antiga}: ${rmError.message}`);
    }
  }

  return { pasta, tabelas, apagadas };
}

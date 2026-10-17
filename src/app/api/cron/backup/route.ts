import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { exportarBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
// Leitura de todas as tabelas + upload dos CSVs: folga além do padrão.
export const maxDuration = 60;

/** Compara em tempo constante, para não vazar o segredo pelo tempo de resposta. */
function mesmoSegredo(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET /api/cron/backup -> exporta as tabelas em CSV para o bucket "backups" (chamado pelo Vercel Cron)
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  // A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron.
  if (!mesmoSegredo(request.headers.get("authorization") ?? "", `Bearer ${segredo}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const resultado = await exportarBackup(getServerSupabase());
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("Falha na exportação semanal em CSV:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

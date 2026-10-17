import { NextResponse } from "next/server";
import { importContas, sanitizeConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

const VENCIMENTO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTAS = 5000;

// POST /api/contas/importar -> importa as contas lidas da planilha (pula as que já existem)
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const lista = (body as { contas?: unknown } | null)?.contas;
  if (!Array.isArray(lista)) {
    return NextResponse.json({ error: "O campo 'contas' deve ser uma lista." }, { status: 400 });
  }
  if (lista.length > MAX_CONTAS) {
    return NextResponse.json({ error: `Importe no máximo ${MAX_CONTAS} contas por vez.` }, { status: 400 });
  }

  const contas = lista.map(sanitizeConta);
  const invalida = contas.findIndex((c) => !c.categoria.trim() || !c.beneficiario.trim() || !VENCIMENTO_RE.test(c.vencimento));
  if (invalida >= 0) {
    return NextResponse.json({ error: `A conta ${invalida + 1} precisa de categoria, beneficiário e vencimento (yyyy-mm-dd).` }, { status: 400 });
  }

  try {
    return NextResponse.json(await importContas(contas), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

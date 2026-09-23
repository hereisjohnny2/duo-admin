import { NextResponse } from "next/server";
import { listContas, insertConta, sanitizeConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// GET /api/contas -> lista todas as contas
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listContas());
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// POST /api/contas -> cria uma nova conta
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const data = sanitizeConta(body);
  if (!data.categoria.trim()) {
    return NextResponse.json({ error: "O campo 'categoria' é obrigatório." }, { status: 400 });
  }
  if (!data.beneficiario.trim()) {
    return NextResponse.json({ error: "O campo 'beneficiario' é obrigatório." }, { status: 400 });
  }

  try {
    const nova = await insertConta(data);
    return NextResponse.json(nova, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { duplicateContasMes } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

const MES_RE = /^\d{4}-\d{2}$/;

// POST /api/contas/duplicate -> duplica as contas de um mês para outro
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { mesOrigem, mesDestino } = body as Record<string, unknown>;
  if (typeof mesOrigem !== "string" || !MES_RE.test(mesOrigem)) {
    return NextResponse.json({ error: "O campo 'mesOrigem' deve estar no formato yyyy-mm." }, { status: 400 });
  }
  if (typeof mesDestino !== "string" || !MES_RE.test(mesDestino)) {
    return NextResponse.json({ error: "O campo 'mesDestino' deve estar no formato yyyy-mm." }, { status: 400 });
  }
  if (mesOrigem === mesDestino) {
    return NextResponse.json({ error: "Escolha um mês de destino diferente do mês de origem." }, { status: 400 });
  }

  try {
    const novas = await duplicateContasMes(mesOrigem, mesDestino);
    return NextResponse.json(novas, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

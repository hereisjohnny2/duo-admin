import { NextResponse } from "next/server";
import { updateConta, deleteConta, pickContaPatch } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// PUT /api/contas/:id -> atualiza (parcial ou total) uma conta
export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const patch = pickContaPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  try {
    const updated = await updateConta(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// DELETE /api/contas/:id -> remove uma conta
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ok = await deleteConta(id);
    if (!ok) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

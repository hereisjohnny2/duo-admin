import { NextResponse } from "next/server";
import { updateInventarioItem, deleteInventarioItem, pickInventarioPatch } from "@/lib/db";
import { CAT_PREFIX, UNIDADES } from "@/lib/inventario";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// PUT /api/inventario/:id -> atualiza (parcial ou total) um item
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

  const patch = pickInventarioPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }
  if (patch.categoria !== undefined && !CAT_PREFIX[patch.categoria]) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  if (patch.unidade !== undefined && !UNIDADES.includes(patch.unidade)) {
    return NextResponse.json({ error: "Unidade inválida." }, { status: 400 });
  }

  try {
    const updated = await updateInventarioItem(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// DELETE /api/inventario/:id -> remove um item
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ok = await deleteInventarioItem(id);
    if (!ok) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

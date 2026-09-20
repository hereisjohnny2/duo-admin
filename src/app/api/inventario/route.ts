import { NextResponse } from "next/server";
import { listInventario, insertInventarioItem, sanitizeInventarioItem } from "@/lib/db";
import { CAT_PREFIX, UNIDADES } from "@/lib/inventario";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// GET /api/inventario -> lista todos os itens de estoque
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listInventario());
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// POST /api/inventario -> cria um item (o código é gerado a partir da categoria)
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const data = sanitizeInventarioItem(body);
  if (!data.produto.trim()) {
    return NextResponse.json({ error: "O campo 'produto' é obrigatório." }, { status: 400 });
  }
  if (!CAT_PREFIX[data.categoria]) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }
  if (!UNIDADES.includes(data.unidade)) {
    return NextResponse.json({ error: "Unidade inválida." }, { status: 400 });
  }

  try {
    const novo = await insertInventarioItem(data);
    return NextResponse.json(novo, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

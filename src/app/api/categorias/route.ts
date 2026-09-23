import { NextResponse } from "next/server";
import { listCategorias, insertCategoria } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// GET /api/categorias -> lista todas as categorias
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listCategorias());
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// POST /api/categorias -> cria uma nova categoria
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nome = body && typeof body === "object" ? String((body as Record<string, unknown>).nome ?? "").trim() : "";
  if (!nome) {
    return NextResponse.json({ error: "O campo 'nome' é obrigatório." }, { status: 400 });
  }

  try {
    const nova = await insertCategoria(nome);
    return NextResponse.json(nova, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { updateConta, deleteConta, pickContaPatch } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { deleteContaArquivos, renomearPdfConta } from "@/lib/contasStorage";

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
    // O nome do PDF vem de categoria/beneficiário/identificação/vencimento. Se o
    // rename falhar, a edição continua valendo e o arquivo fica com o nome antigo.
    const renamed = await renomearPdfConta(updated).catch((e) => {
      console.error("Falha ao renomear o PDF da conta:", e);
      return updated;
    });
    return NextResponse.json(renamed);
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
    const removida = await deleteConta(id);
    if (!removida) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    // PDF no Storage: falhas não desfazem a exclusão, só ficam no log.
    if (removida.pdf) await deleteContaArquivos([removida.pdf.path]).catch((e) => console.error("Falha ao apagar o PDF da conta:", e));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

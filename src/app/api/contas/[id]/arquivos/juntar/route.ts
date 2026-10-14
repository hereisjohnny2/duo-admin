import { NextResponse } from "next/server";
import { getConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { juntarConta } from "@/lib/contasStorage";
import { ArquivoInvalidoError } from "@/lib/contasPdf";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// POST /api/contas/:id/arquivos/juntar -> junta boleto + comprovante no PDF único BOL_... (apaga os separados)
export async function POST(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const conta = await getConta(id);
    if (!conta) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    const updated = await juntarConta(conta);
    if (!updated) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: e instanceof ArquivoInvalidoError ? 400 : 500 });
  }
}

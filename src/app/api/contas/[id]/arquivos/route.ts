import { NextResponse } from "next/server";
import { getConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { downloadContaPdf } from "@/lib/contasStorage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// GET /api/contas/:id/arquivos -> abre o PDF da conta (boleto + comprovante)
export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const conta = await getConta(id);
    if (!conta?.pdf) {
      return NextResponse.json({ error: "Esta conta não tem PDF." }, { status: 404 });
    }

    const blob = await downloadContaPdf(conta.pdf.path);
    if (!blob) {
      return NextResponse.json({ error: "O arquivo não existe mais no armazenamento." }, { status: 404 });
    }

    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(conta.pdf.nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { respostaErroArquivo } from "@/lib/erroArquivo";
import { downloadContaPdf } from "@/lib/contasStorage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

// GET /api/contas/:id/arquivos -> abre o PDF da conta (boleto + comprovante)
export async function GET(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return respostaErroArquivo(request, "Não autenticado.", 401);
  }

  const { id } = await params;
  try {
    const conta = await getConta(id);
    if (!conta?.pdf) {
      return respostaErroArquivo(request, "Esta conta não tem um PDF com o boleto e o comprovante juntos.", 404);
    }

    const blob = await downloadContaPdf(conta.pdf.path);
    if (!blob) {
      return respostaErroArquivo(request, "O PDF não existe mais no armazenamento. Anexe os arquivos de novo.", 404);
    }

    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(conta.pdf.nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return respostaErroArquivo(request, errMsg(e), 500);
  }
}

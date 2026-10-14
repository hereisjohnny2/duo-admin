import { NextResponse } from "next/server";
import { getConta } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { downloadContaPdf, salvarParteConta } from "@/lib/contasStorage";
import { ArquivoInvalidoError } from "@/lib/contasPdf";
import { CONTA_ARQUIVO_LABEL, isContaArquivoTipo, validateContaArquivo } from "@/lib/contasCompute";
import type { ContaArquivoTipo } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; tipo: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

/** Arquivo ilegível/protegido ou conta sem vencimento é erro do pedido (400), não do servidor. */
function errorResponse(e: unknown) {
  return NextResponse.json({ error: errMsg(e) }, { status: e instanceof ArquivoInvalidoError ? 400 : 500 });
}

async function resolve(params: Params["params"]): Promise<{ id: string; tipo: ContaArquivoTipo } | null> {
  const { id, tipo } = await params;
  return isContaArquivoTipo(tipo) ? { id, tipo } : null;
}

// GET /api/contas/:id/arquivos/:tipo -> abre o arquivo próprio do boleto (BOL_...) ou do comprovante (COMP_...)
export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const target = await resolve(params);
  if (!target) {
    return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 400 });
  }

  try {
    const conta = await getConta(target.id);
    const arquivo = conta?.[target.tipo]?.arquivo;
    if (!arquivo) {
      // Já juntado: a parte está dentro do PDF único (GET /api/contas/:id/arquivos).
      return NextResponse.json({ error: `${CONTA_ARQUIVO_LABEL[target.tipo]} não tem arquivo próprio.` }, { status: 404 });
    }

    const blob = await downloadContaPdf(arquivo.path);
    if (!blob) {
      return NextResponse.json({ error: "O arquivo não existe mais no armazenamento." }, { status: 404 });
    }
    return new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// PUT /api/contas/:id/arquivos/:tipo (multipart, campo "file") -> envia/substitui o boleto ou o comprovante (arquivo próprio)
export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const target = await resolve(params);
  if (!target) {
    return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo no campo 'file'." }, { status: 400 });
  }
  const invalid = validateContaArquivo(file);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  try {
    const conta = await getConta(target.id);
    if (!conta) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const updated = await salvarParteConta(conta, target.tipo, { nome: file.name, type: file.type, bytes: await file.arrayBuffer() });
    if (!updated) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/contas/:id/arquivos/:tipo -> remove o boleto ou o comprovante
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const target = await resolve(params);
  if (!target) {
    return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 400 });
  }

  try {
    const conta = await getConta(target.id);
    if (!conta) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    if (!conta[target.tipo]) return NextResponse.json(conta);

    const updated = await salvarParteConta(conta, target.tipo, null);
    if (!updated) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

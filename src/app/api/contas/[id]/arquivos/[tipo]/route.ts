import { NextResponse } from "next/server";
import { getConta, setContaArquivo } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { contaArquivoPath, deleteContaArquivos, downloadContaArquivo, uploadContaArquivo } from "@/lib/contasStorage";
import { CONTA_ARQUIVO_LABEL, isContaArquivoTipo, validateContaArquivo } from "@/lib/contasCompute";
import type { ContaArquivoTipo } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; tipo: string }> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado.");

/** Apaga um arquivo do Storage sem derrubar a requisição (o principal já foi feito). */
async function deleteQuietly(path: string) {
  await deleteContaArquivos([path]).catch((e) => console.error("Falha ao apagar arquivo da conta:", e));
}

async function resolve(params: Params["params"]): Promise<{ id: string; tipo: ContaArquivoTipo } | null> {
  const { id, tipo } = await params;
  return isContaArquivoTipo(tipo) ? { id, tipo } : null;
}

// GET /api/contas/:id/arquivos/:tipo -> abre o boleto/comprovante
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
    const arquivo = conta?.[target.tipo];
    if (!arquivo) {
      return NextResponse.json({ error: `${CONTA_ARQUIVO_LABEL[target.tipo]} não encontrado.` }, { status: 404 });
    }

    const blob = await downloadContaArquivo(arquivo.path);
    if (!blob) {
      return NextResponse.json({ error: "O arquivo não existe mais no armazenamento." }, { status: 404 });
    }

    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// PUT /api/contas/:id/arquivos/:tipo (multipart, campo "file") -> envia/substitui o arquivo
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

    const path = contaArquivoPath(target.id, target.tipo, file.name);
    await uploadContaArquivo(path, { type: file.type, data: await file.arrayBuffer() });
    let updated;
    try {
      updated = await setContaArquivo(target.id, target.tipo, { path, nome: file.name });
    } catch (e) {
      await deleteQuietly(path); // não deixa arquivo órfão no Storage
      throw e;
    }
    if (!updated) {
      await deleteQuietly(path); // a conta foi excluída no meio do caminho
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    }

    const anterior = conta[target.tipo];
    if (anterior) await deleteQuietly(anterior.path);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// DELETE /api/contas/:id/arquivos/:tipo -> remove o arquivo da conta e do Storage
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

    const anterior = conta[target.tipo];
    const updated = anterior ? await setContaArquivo(target.id, target.tipo, null) : conta;
    if (anterior) await deleteQuietly(anterior.path);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

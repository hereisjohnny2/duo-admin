import { NextResponse } from "next/server";

/* =====================================================================
   Erro ao abrir um arquivo da conta (PDF, boleto ou comprovante).
   Os links da tela abrem a rota da API direto numa aba nova; nesse caso
   (navegação, que pede HTML) a resposta é uma página simples com a
   mensagem, em vez do JSON cru. Chamadas do app (fetch) seguem com JSON.
   ===================================================================== */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function paginaErroArquivo(mensagem: string): string {
  const msg = escapeHtml(mensagem);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arquivo não disponível</title>
<style>
  :root { --bg: #f4f4f4; --panel: #ffffff; --ink: #1e1e1e; --muted: #666666; --line: #dddddd; --brand: #333333; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #151515; --panel: #1e1e1e; --ink: #eeeeee; --muted: #a6a6a6; --line: #3a3a3a; --brand: #cccccc; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         background: var(--bg); color: var(--ink); font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .card { width: 100%; max-width: 420px; background: var(--panel); border: 1px solid var(--line);
          border-radius: 14px; padding: 24px 22px; text-align: center; }
  h1 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0 0 18px; color: var(--muted); font-size: 14px; line-height: 1.5; }
  a { color: var(--brand); font-weight: 600; font-size: 14px; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <main class="card">
    <h1>Arquivo não disponível</h1>
    <p>${msg}</p>
    <a href="/contas">Voltar para Contas</a>
  </main>
</body>
</html>`;
}

/** Erro como página (navegação do browser) ou JSON (fetch do app), conforme o Accept. */
export function respostaErroArquivo(request: Request, mensagem: string, status: number): Response {
  if ((request.headers.get("accept") ?? "").includes("text/html")) {
    return new Response(paginaErroArquivo(mensagem), {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ error: mensagem }, { status });
}

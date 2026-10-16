import { describe, expect, it } from "vitest";

import { respostaErroArquivo } from "../../src/lib/erroArquivo";

const req = (accept: string) => new Request("http://localhost/api/contas/1/arquivos", { headers: { accept } });

describe("respostaErroArquivo", () => {
  it("shows a readable page when the browser opens the link", async () => {
    const res = respostaErroArquivo(req("text/html,application/xhtml+xml,*/*;q=0.8"), "Esta conta não tem PDF.", 404);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<p>Esta conta não tem PDF.</p>");
    expect(html).toContain('href="/contas"');
  });

  it("keeps answering JSON to the app's own requests", async () => {
    const res = respostaErroArquivo(req("*/*"), "Esta conta não tem PDF.", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Esta conta não tem PDF." });
  });

  it("escapes the message inside the page", async () => {
    const html = await respostaErroArquivo(req("text/html"), '<script>alert("x")</script>', 500).text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

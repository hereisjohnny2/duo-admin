import { describe, expect, it } from "vitest";

import { ERRO_CONEXAO, mensagemErroAuth, mensagemErroBanco, motivoErroStorage } from "../../src/lib/mensagensErro";

describe("mensagens de erro em português", () => {
  it("traduz os erros do Supabase Auth pelo código", () => {
    expect(mensagemErroAuth({ code: "same_password", message: "New password should be different from the old password." })).toBe(
      "A nova senha precisa ser diferente da senha atual."
    );
    expect(mensagemErroAuth({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
    expect(mensagemErroAuth({ status: 0, name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe(ERRO_CONEXAO);
  });

  it("nunca repassa a mensagem em inglês de um erro desconhecido", () => {
    expect(mensagemErroAuth({ code: "algo_novo", message: "Something new" })).not.toMatch(/Something/);
    expect(mensagemErroBanco({ code: "XX000", message: "internal error" })).toBe("Erro ao acessar o banco de dados. Tente de novo.");
    expect(motivoErroStorage({ message: "Bucket is on fire" })).toBe("erro no armazenamento de arquivos");
  });

  it("traduz os erros do banco e do Storage mais comuns", () => {
    expect(mensagemErroBanco({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe("Já existe um registro com esses dados.");
    expect(mensagemErroBanco({ code: "23514", message: "new row violates check constraint" })).toMatch(/não é permitido/);
    expect(motivoErroStorage({ message: "The object exceeded the maximum allowed size" })).toBe("o arquivo é grande demais");
    expect(motivoErroStorage({ message: "Object not found" })).toBe("o arquivo não foi encontrado");
  });
});

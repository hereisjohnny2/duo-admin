import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("react-toastify", () => ({ toast }));

import { mensagemDeErro, notify } from "../../src/lib/notify";

describe("notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps each kind of notice to its toast", () => {
    notify.sucesso("Conta criada.");
    notify.info("2 já existiam.");
    notify.aviso("Informe o beneficiário.");
    expect(toast.success).toHaveBeenCalledWith("Conta criada.");
    expect(toast.info).toHaveBeenCalledWith("2 já existiam.");
    expect(toast.warning).toHaveBeenCalledWith("Informe o beneficiário.");
  });

  it("shows the API error message, or the fallback when there is none", () => {
    notify.erro(new Error("Conta não encontrada."), "Erro ao salvar.");
    notify.erro(null, "Erro ao salvar.");
    notify.erro("Texto pronto.");
    expect(toast.error.mock.calls.map((c) => c[0])).toEqual(["Conta não encontrada.", "Erro ao salvar.", "Texto pronto."]);
    expect(mensagemDeErro(new Error(""), "padrão")).toBe("padrão");
  });
});

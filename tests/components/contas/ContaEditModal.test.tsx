import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContaEditModal from "@/components/contas/ContaEditModal";
import { notify } from "@/lib/notify";
import type { Conta, ContaArquivoTipo, ContaInput } from "@/lib/types";

vi.mock("@/lib/notify", () => ({ notify: { sucesso: vi.fn(), info: vi.fn(), aviso: vi.fn(), erro: vi.fn() } }));

const categorias = [{ id: "cat-1", nome: "IPTU" }];

const conta: Conta = {
  id: "c1",
  categoria: "IPTU",
  beneficiario: "Prefeitura",
  identificacao: "Casa 2",
  vencimento: "2026-04-10",
  dataDebito: "",
  saida: "R$ 10,00",
  status: "Em Aberto",
  observacoes: "",
  boleto: null,
  comprovante: null,
  pdf: null,
};

const comBoleto: Conta = {
  ...conta,
  boleto: { nome: "boleto.pdf", paginas: 2, arquivo: { path: "2026/04 - Abril/x/BOL_IPTU.pdf", nome: "BOL_IPTU.pdf" } },
};

const pdf = (nome = "boleto.pdf") => new File(["%PDF-1.4"], nome, { type: "application/pdf" });

/** Promise que o teste resolve quando quiser (para ver o estado "salvando"). */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(editing: Conta | null, overrides: Partial<React.ComponentProps<typeof ContaEditModal>> = {}) {
  const props = {
    open: true,
    editing,
    categorias,
    onClose: vi.fn(),
    onSave: vi.fn(async (_data: ContaInput, _id: string | null) => {}),
    onSalvarConta: vi.fn(async (data: ContaInput, id: string | null): Promise<Conta | null> => ({ ...conta, ...data, id: id ?? "nova" })),
    onArquivo: vi.fn(async (c: Conta, tipo: ContaArquivoTipo, file: File | null): Promise<Conta | null> =>
      file ? { ...c, [tipo]: { nome: file.name, paginas: 1, arquivo: { path: `p/${file.name}`, nome: `BOL_${tipo}.pdf` } } } : { ...c, [tipo]: null }
    ),
    onCreateCategoria: vi.fn(),
    onJuntar: vi.fn(async () => null),
    ...overrides,
  };
  render(<ContaEditModal {...props} />);
  return props;
}

describe("ContaEditModal files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a file as soon as it is picked, without closing the modal", async () => {
    const user = userEvent.setup();
    const props = setup(conta);

    await user.upload(screen.getByLabelText("Boleto"), pdf());

    await waitFor(() => expect(props.onArquivo).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "boleto", expect.any(File)));
    // Os campos não mudaram: não precisa salvar a conta antes.
    expect(props.onSalvarConta).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(await screen.findByText("boleto.pdf")).toBeInTheDocument();
  });

  it("saves a new conta first, then uploads, and Salvar updates it instead of creating another", async () => {
    const user = userEvent.setup();
    const props = setup(null);

    // O primeiro select é o de categoria.
    await user.selectOptions(screen.getAllByRole("combobox")[0], "IPTU");
    await user.type(screen.getByPlaceholderText("Nome do beneficiário"), "Prefeitura");
    const [vencimento] = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await user.type(vencimento, "2026-04-10");

    await user.upload(screen.getByLabelText("Comprovante"), pdf("pix.pdf"));

    await waitFor(() => expect(props.onArquivo).toHaveBeenCalledWith(expect.objectContaining({ id: "nova" }), "comprovante", expect.any(File)));
    expect(props.onSalvarConta).toHaveBeenCalledWith(expect.objectContaining({ beneficiario: "Prefeitura" }), null);
    expect(screen.getByText("Editar conta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ beneficiario: "Prefeitura" }), "nova");
  });

  it("asks for the vencimento before uploading", async () => {
    const user = userEvent.setup();
    const props = setup({ ...conta, vencimento: "" });

    await user.upload(screen.getByLabelText("Boleto"), pdf());

    expect(notify.aviso).toHaveBeenCalledWith(expect.stringMatching(/vencimento/));
    expect(props.onArquivo).not.toHaveBeenCalled();
  });

  it("removes a file right away after confirming", async () => {
    const user = userEvent.setup();
    const props = setup(comBoleto);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(props.onArquivo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("alertdialog").querySelector("button.danger-solid")!);

    await waitFor(() => expect(props.onArquivo).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "boleto", null));
    expect(await screen.findAllByText("Nenhum arquivo")).toHaveLength(2);
  });

  it("locks every field and shows a spinner while saving", async () => {
    const user = userEvent.setup();
    const salvando = deferred<void>();
    const props = setup(conta, { onSave: vi.fn(() => salvando.promise) });

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const salvar = screen.getByRole("button", { name: /Salvando/ });
    expect(salvar).toBeDisabled();
    expect(salvar.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByPlaceholderText("Nome do beneficiário")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(props.onClose).not.toHaveBeenCalled();

    await act(async () => salvando.resolve());
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Nome do beneficiário")).toBeEnabled();
  });

  it("locks the modal while a file is uploading", async () => {
    const user = userEvent.setup();
    const envio = deferred<Conta | null>();
    setup(conta, { onArquivo: vi.fn(() => envio.promise) });

    await user.upload(screen.getByLabelText("Boleto"), pdf());

    expect(await screen.findByText("Enviando…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Nome do beneficiário")).toBeDisabled();

    await act(async () => envio.resolve(comBoleto));
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });
});

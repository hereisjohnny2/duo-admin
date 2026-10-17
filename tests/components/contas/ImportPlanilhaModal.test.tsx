import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ImportPlanilhaModal from "@/components/contas/ImportPlanilhaModal";
import type { Conta, ContaInput } from "@/lib/types";
import { aba, serial, xlsx } from "../../helpers/xlsx";

const existente: Conta = {
  id: "c1",
  categoria: "Água",
  beneficiario: "RIO+SANEAMENTO",
  identificacao: "VIVERDE - LOTE 187",
  vencimento: "2026-01-28",
  dataDebito: "",
  saida: "R$ 264,22",
  status: "Pago",
  observacoes: "",
  boleto: null,
  comprovante: null,
  pdf: null,
};

const planilha = () =>
  new File(
    [
      xlsx({
        JAN: aba("JANEIRO", [["ÁGUA", "RIO+SANEAMENTO", "VIVERDE - LOTE 187", serial("2026-01-28"), null, 264.22, null, "PAGO", null]]),
        NOV: aba("NOVEMBRO", [
          ["ÁGUA", "RIO+SANEAMENTO", "VIVERDE - LOTE 187", serial("2026-11-28"), null, 264.22, null, "EM ABERTO", null],
          ["IPTU", "PREFEITURA", "CASA", serial("2026-11-10"), null, 100, null, "EM ABERTO", null],
        ]),
      }) as BlobPart,
    ],
    "CTR03.R00_FINANCEIRO_2026.xlsx",
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );

function setup() {
  const props = {
    open: true,
    contas: [existente],
    categorias: [{ id: "cat-1", nome: "Água" }],
    onClose: vi.fn(),
    onConfirm: vi.fn(async (_contas: ContaInput[]) => {}),
  };
  render(<ImportPlanilhaModal {...props} />);
  return props;
}

describe("ImportPlanilhaModal", () => {
  it("previews each month, skipping contas that already exist, and imports the chosen months", async () => {
    const user = userEvent.setup();
    const props = setup();

    expect(screen.getByRole("button", { name: /Importar 0 conta/ })).toBeDisabled();
    await user.upload(screen.getByLabelText("Planilha"), planilha());

    // Janeiro só tem a conta que já existe: nada a importar, fica desmarcado.
    const janeiro = await screen.findByRole("checkbox", { name: /Janeiro 2026/ });
    expect(janeiro).not.toBeChecked();
    expect(janeiro).toBeDisabled();
    expect(screen.getByText(/0 nova\(s\) · 1 já existe/)).toBeInTheDocument();

    // Novembro ainda não existe: as duas contas entram (o mês é criado).
    expect(screen.getByRole("checkbox", { name: /Novembro 2026/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Importar 2 conta(s)" }));

    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
    const enviadas = props.onConfirm.mock.calls[0][0];
    expect(enviadas.map((c) => [c.categoria, c.beneficiario, c.vencimento])).toEqual([
      ["Água", "RIO+SANEAMENTO", "2026-11-28"],
      ["IPTU", "PREFEITURA", "2026-11-10"],
    ]);
  });

  it("shows an error for files that are not the spreadsheet", async () => {
    const user = userEvent.setup();
    setup();

    await user.upload(screen.getByLabelText("Planilha"), new File(["oi"], "x.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/xlsx válida/);
  });
});

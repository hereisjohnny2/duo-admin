import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConfirmDialog from "@/components/ConfirmDialog";

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmDialog open title="Excluir conta" message="Excluir a conta X?" onConfirm={onConfirm} onCancel={onCancel} {...props} />);
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    render(<ConfirmDialog open={false} title="Excluir" message="?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the message and focuses the confirm button", () => {
    setup();
    expect(screen.getByRole("alertdialog", { name: "Excluir conta" })).toBeInTheDocument();
    expect(screen.getByText("Excluir a conta X?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveFocus();
  });

  it("confirms or cancels from its buttons", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup({ confirmLabel: "Remover" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("disables the buttons while the confirmation is running", async () => {
    let finish!: () => void;
    const { onCancel } = setup({ onConfirm: () => new Promise<void>((r) => (finish = r)) });

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("button", { name: "Excluindo…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(onCancel).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Excluir" })).toBeEnabled());
  });

  it("cancels on Escape without letting it reach other listeners", () => {
    const { onCancel } = setup();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outer);
  });
});

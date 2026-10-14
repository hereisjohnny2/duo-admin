"use client";

import { useEffect, useRef, useState } from "react";

/* Confirmação dentro do app, no lugar do confirm() do navegador
   (que alguns navegadores embutidos bloqueiam, respondendo "não"). */

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = "Excluir", onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false);
  const downOnBackdrop = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Os pais passam onCancel inline; com a ref, o efeito só roda quando o diálogo abre/fecha.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    confirmRef.current?.focus();
    // Captura e para o Esc aqui, para não fechar também o modal que estiver por baixo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancelRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current && !busy) onCancel();
      }}
    >
      <div className="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="modal-head">
          <h3 id="confirm-dialog-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button ref={confirmRef} className="btn danger-solid" onClick={confirm} disabled={busy}>
            {busy ? "Excluindo…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

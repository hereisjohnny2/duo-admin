"use client";

import { useEffect, useRef, useState } from "react";
import { mesLabel } from "@/lib/contasCompute";

function nextMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m, 1); // m já é 1-based (mês seguinte)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  meses: string[]; // meses existentes ("yyyy-mm"), para escolher a origem
  onClose: () => void;
  onConfirm: (mesOrigem: string, mesDestino: string) => Promise<void>;
}

export default function DuplicateMesModal({ open, meses, onClose, onConfirm }: Props) {
  const [mesOrigem, setMesOrigem] = useState("");
  const [mesDestino, setMesDestino] = useState("");
  const [saving, setSaving] = useState(false);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const origem = meses[meses.length - 1] ?? "";
    setMesOrigem(origem);
    setMesDestino(origem ? nextMes(origem) : "");
  }, [open, meses]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!mesOrigem || !mesDestino) {
      alert("Selecione o mês de origem e o mês de destino.");
      return;
    }
    if (mesOrigem === mesDestino) {
      alert("Escolha um mês de destino diferente do mês de origem.");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(mesOrigem, mesDestino);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>Duplicar mês</h3>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="hint">Copia todas as contas do mês de origem para o mês de destino, marcadas como &quot;Em Aberto&quot; e sem data de débito.</p>
          <div className="field">
            <label>Mês de origem</label>
            {meses.length > 0 ? (
              <select value={mesOrigem} onChange={(e) => setMesOrigem(e.target.value)}>
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {mesLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="status-msg">Nenhum mês com contas cadastradas ainda.</p>
            )}
          </div>
          <div className="field">
            <label>Mês de destino</label>
            <input type="month" value={mesDestino} onChange={(e) => setMesDestino(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={saving || meses.length === 0} onClick={submit}>
            {saving ? "Duplicando..." : "Duplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

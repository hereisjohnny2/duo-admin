"use client";

import { useEffect, useRef, useState } from "react";
import type { Categoria, Conta, ContaInput } from "@/lib/types";
import { CONTA_STATUSES } from "@/lib/contasCompute";

const EMPTY: ContaInput = {
  categoria: "",
  beneficiario: "",
  identificacao: "",
  vencimento: "",
  dataDebito: "",
  saida: "",
  status: "Em Aberto",
  observacoes: "",
};

const NEW_CATEGORIA = "__nova__";

interface Props {
  open: boolean;
  editing: Conta | null;
  categorias: Categoria[];
  onClose: () => void;
  onSave: (data: ContaInput) => void;
  onCreateCategoria: (nome: string) => Promise<Categoria>;
}

export default function ContaEditModal({ open, editing, categorias, onClose, onSave, onCreateCategoria }: Props) {
  const [form, setForm] = useState<ContaInput>(EMPTY);
  const [addingCategoria, setAddingCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCategoria, setSavingCategoria] = useState(false);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    setAddingCategoria(false);
    setNovaCategoria("");
    if (editing) {
      const { id: _id, ...rest } = editing;
      void _id;
      setForm({ ...EMPTY, ...rest });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k: keyof ContaInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onCategoriaSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === NEW_CATEGORIA) {
      setAddingCategoria(true);
      return;
    }
    setForm((f) => ({ ...f, categoria: e.target.value }));
  };

  const confirmNovaCategoria = async () => {
    const nome = novaCategoria.trim();
    if (!nome) return;
    setSavingCategoria(true);
    try {
      const categoria = await onCreateCategoria(nome);
      setForm((f) => ({ ...f, categoria: categoria.nome }));
      setAddingCategoria(false);
      setNovaCategoria("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar categoria.");
    } finally {
      setSavingCategoria(false);
    }
  };

  const submit = () => {
    if (!form.categoria.trim()) {
      alert("Selecione ou adicione uma categoria.");
      return;
    }
    if (!form.beneficiario.trim()) {
      alert("Informe o beneficiário.");
      return;
    }
    onSave(form);
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
          <h3>{editing ? "Editar conta" : "Nova conta"}</h3>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Categoria *</label>
            {!addingCategoria ? (
              <select value={form.categoria} onChange={onCategoriaSelect}>
                <option value="" disabled>
                  Selecione uma categoria...
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
                <option value={NEW_CATEGORIA}>+ Adicionar nova categoria...</option>
              </select>
            ) : (
              <div className="row2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome da nova categoria"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmNovaCategoria();
                    }
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn primary" disabled={savingCategoria} onClick={confirmNovaCategoria}>
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setAddingCategoria(false);
                      setNovaCategoria("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="row2">
            <div className="field">
              <label>Beneficiário *</label>
              <input type="text" placeholder="Nome do beneficiário" value={form.beneficiario} onChange={set("beneficiario")} />
            </div>
            <div className="field">
              <label>Identificação</label>
              <input type="text" placeholder="ex: Endereço, contrato..." value={form.identificacao} onChange={set("identificacao")} />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Vencimento</label>
              <input type="date" value={form.vencimento} onChange={set("vencimento")} />
            </div>
            <div className="field">
              <label>Data de Débito</label>
              <input type="date" value={form.dataDebito} onChange={set("dataDebito")} />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Saída</label>
              <input type="text" placeholder="R$ 0,00" value={form.saida} onChange={set("saida")} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={set("status")}>
                {CONTA_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Observações</label>
            <textarea rows={3} placeholder="Detalhes da conta..." value={form.observacoes} onChange={set("observacoes")} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={submit}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

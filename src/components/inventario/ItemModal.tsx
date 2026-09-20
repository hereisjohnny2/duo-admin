"use client";

import { useEffect, useRef, useState } from "react";
import type { InventarioItem, InventarioItemInput } from "@/lib/types";
import { CATEGORIAS, clampQtd, UNIDADES } from "@/lib/inventario";

/** O formulário guarda os números como texto para permitir o campo vazio. */
interface Form {
  produto: string;
  categoria: string;
  quantidade: string;
  unidade: string;
  estoqueMinimo: string;
  localizacao: string;
  observacoes: string;
}

const EMPTY: Form = {
  produto: "",
  categoria: "Hidráulica",
  quantidade: "1",
  unidade: "un",
  estoqueMinimo: "1",
  localizacao: "",
  observacoes: "",
};

interface Props {
  open: boolean;
  editing: InventarioItem | null;
  onClose: () => void;
  onSave: (data: InventarioItemInput) => void;
  onDelete: (item: InventarioItem) => void;
}

export default function ItemModal({ open, editing, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        produto: editing.produto,
        categoria: editing.categoria,
        quantidade: String(editing.quantidade),
        unidade: editing.unidade,
        estoqueMinimo: String(editing.estoqueMinimo),
        localizacao: editing.localizacao,
        observacoes: editing.observacoes,
      });
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

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.produto.trim()) {
      alert("Informe o nome do produto.");
      return;
    }
    onSave({
      produto: form.produto.trim(),
      categoria: form.categoria,
      quantidade: clampQtd(Number(form.quantidade)),
      unidade: form.unidade,
      estoqueMinimo: clampQtd(Number(form.estoqueMinimo)),
      localizacao: form.localizacao,
      observacoes: form.observacoes,
    });
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
          <h3>{editing ? "Editar item" : "Novo item"}</h3>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {editing && (
            <p className="inv-modal-code">
              Código <b>{editing.codigo}</b>
            </p>
          )}

          <div className="field">
            <label>Produto *</label>
            <input autoFocus type="text" placeholder="Nome do produto" value={form.produto} onChange={set("produto")} />
          </div>

          <div className="field">
            <label>Categoria</label>
            <select value={form.categoria} onChange={set("categoria")} disabled={!!editing}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {editing && <span className="foot-note">A categoria define o código, então não muda depois de criado.</span>}
          </div>

          <div className="row2">
            <div className="field">
              <label>Quantidade</label>
              <input type="number" min="0" step="0.5" placeholder="0" value={form.quantidade} onChange={set("quantidade")} />
            </div>
            <div className="field">
              <label>Unidade</label>
              <select value={form.unidade} onChange={set("unidade")}>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Estoque mínimo</label>
              <input type="number" min="0" step="0.5" placeholder="0" value={form.estoqueMinimo} onChange={set("estoqueMinimo")} />
            </div>
            <div className="field">
              <label>Localização</label>
              <input type="text" placeholder="ex: Prateleira A3" value={form.localizacao} onChange={set("localizacao")} />
            </div>
          </div>

          <div className="field">
            <label>Observações</label>
            <textarea rows={3} placeholder="Anotações sobre o item..." value={form.observacoes} onChange={set("observacoes")} />
          </div>
        </div>
        <div className="modal-foot">
          {editing && (
            <button className="btn danger inv-modal-delete" onClick={() => onDelete(editing)}>
              Remover item
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={submit}>
            {editing ? "Salvar" : "Adicionar ao estoque"}
          </button>
        </div>
      </div>
    </div>
  );
}

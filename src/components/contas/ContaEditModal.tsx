"use client";

import { useEffect, useRef, useState } from "react";
import type { Categoria, Conta, ContaArquivoTipo, ContaInput } from "@/lib/types";
import { CONTA_ARQUIVO_ACCEPT, CONTA_ARQUIVO_LABEL, CONTA_ARQUIVO_TIPOS, CONTA_STATUSES, contaParteUrl, contaPdfUrl, nomePdfConta, validateContaArquivo } from "@/lib/contasCompute";

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

/** Mudanças de arquivo a aplicar depois de salvar: File = enviar, null = remover; ausente = manter. */
export type ArquivosPendentes = Partial<Record<ContaArquivoTipo, File | null>>;

interface Props {
  open: boolean;
  editing: Conta | null;
  categorias: Categoria[];
  onClose: () => void;
  onSave: (data: ContaInput, arquivos: ArquivosPendentes) => void;
  onCreateCategoria: (nome: string) => Promise<Categoria>;
}

export default function ContaEditModal({ open, editing, categorias, onClose, onSave, onCreateCategoria }: Props) {
  const [form, setForm] = useState<ContaInput>(EMPTY);
  const [addingCategoria, setAddingCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivosPendentes>({});
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    setAddingCategoria(false);
    setNovaCategoria("");
    setArquivos({});
    if (editing) {
      const { id: _id, boleto: _boleto, comprovante: _comprovante, pdf: _pdf, ...rest } = editing;
      void _id;
      void _boleto;
      void _comprovante;
      void _pdf;
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
    if (Object.values(arquivos).some(Boolean) && !nomePdfConta(form)) {
      alert("Informe o vencimento para anexar arquivos: o nome do PDF usa o mês e o ano dele.");
      return;
    }
    onSave(form, arquivos);
  };

  const pickArquivo = (tipo: ContaArquivoTipo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    const invalid = validateContaArquivo(file);
    if (invalid) {
      alert(`${CONTA_ARQUIVO_LABEL[tipo]}: ${invalid}`);
      return;
    }
    setArquivos((a) => ({ ...a, [tipo]: file }));
  };

  const resetArquivo = (tipo: ContaArquivoTipo) =>
    setArquivos((a) => {
      const { [tipo]: _removed, ...rest } = a;
      void _removed;
      return rest;
    });

  const nomeBoleto = nomePdfConta(form, "BOL");
  const nomeComprovante = nomePdfConta(form, "COMP");

  const renderArquivo = (tipo: ContaArquivoTipo) => {
    const label = CONTA_ARQUIVO_LABEL[tipo];
    const atual = editing?.[tipo] ?? null;
    const pendente = arquivos[tipo];
    const inputId = `conta-arquivo-${tipo}`;

    let info: React.ReactNode;
    let actions: React.ReactNode;
    if (pendente) {
      info = <span className="arquivo-nome" title={pendente.name}>{pendente.name}</span>;
      actions = (
        <button type="button" className="btn ghost" onClick={() => resetArquivo(tipo)}>
          Desfazer
        </button>
      );
    } else if (atual && pendente !== null) {
      const paginas = `${atual.paginas} pág.`;
      const onde = atual.arquivo ? atual.arquivo.nome : "no PDF único";
      info = (
        <span className="arquivo-nome" title={`${atual.nome} (${paginas}) — ${onde}`}>
          {atual.arquivo ? (
            <a href={contaParteUrl(editing!.id, tipo)} target="_blank" rel="noopener noreferrer">
              {atual.nome}
            </a>
          ) : (
            atual.nome
          )}{" "}
          <span className="muted">
            · {paginas}
            {!atual.arquivo && " · no PDF único"}
          </span>
        </span>
      );
      actions = (
        <button type="button" className="btn ghost" onClick={() => setArquivos((a) => ({ ...a, [tipo]: null }))}>
          Remover
        </button>
      );
    } else {
      info = <span className="arquivo-nome muted">{pendente === null ? "Será removido ao salvar" : "Nenhum arquivo"}</span>;
      actions =
        pendente === null ? (
          <button type="button" className="btn ghost" onClick={() => resetArquivo(tipo)}>
            Desfazer
          </button>
        ) : null;
    }

    return (
      <div className="field" key={tipo}>
        <label htmlFor={inputId}>{label}</label>
        <div className="arquivo-field">
          {info}
          <div className="arquivo-actions">
            {actions}
            <label className="btn ghost" htmlFor={inputId}>
              {atual || pendente ? "Trocar" : "Anexar"}
            </label>
            <input id={inputId} className="arquivo-input" type="file" accept={CONTA_ARQUIVO_ACCEPT} onChange={pickArquivo(tipo)} />
          </div>
        </div>
      </div>
    );
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
          <div className="arquivo-campos">{CONTA_ARQUIVO_TIPOS.map(renderArquivo)}</div>
          <p className="arquivo-hint">
            PDF ou imagem (PNG/JPG) de até 8 MB cada.{" "}
            {nomeBoleto && nomeComprovante ? (
              <>
                O boleto é salvo como <strong className="arquivo-pdf-nome">{nomeBoleto}</strong> e o comprovante como{" "}
                <strong className="arquivo-pdf-nome">{nomeComprovante}</strong>.
              </>
            ) : (
              "Informe o vencimento para definir o nome dos arquivos."
            )}{" "}
            {editing?.pdf ? (
              <>
                Os dois já estão juntos em <strong className="arquivo-pdf-nome">{editing.pdf.nome}</strong>.{" "}
                <a href={contaPdfUrl(editing.id)} target="_blank" rel="noopener noreferrer">
                  Abrir PDF
                </a>
              </>
            ) : (
              "Com os dois anexados, use “Juntar” na lista para gerar um PDF único."
            )}
          </p>
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

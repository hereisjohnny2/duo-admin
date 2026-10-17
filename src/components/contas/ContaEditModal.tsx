"use client";

import { useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import type { Categoria, Conta, ContaArquivoTipo, ContaInput } from "@/lib/types";
import { CONTA_ARQUIVO_ACCEPT, CONTA_ARQUIVO_LABEL, CONTA_ARQUIVO_TIPOS, CONTA_STATUSES, contaParteUrl, contaPdfUrl, nomePdfConta, validateContaArquivo } from "@/lib/contasCompute";
import ConfirmDialog from "../ConfirmDialog";

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

/** Campos do formulário a partir de uma conta salva. */
function formDe(conta: Conta): ContaInput {
  const { id: _id, boleto: _boleto, comprovante: _comprovante, pdf: _pdf, ...rest } = conta;
  void _id;
  void _boleto;
  void _comprovante;
  void _pdf;
  return { ...EMPTY, ...rest };
}

interface Props {
  open: boolean;
  editing: Conta | null;
  categorias: Categoria[];
  onClose: () => void;
  /** Salva e fecha o modal (se der certo). `id` null = criar a conta. */
  onSave: (data: ContaInput, id: string | null) => Promise<void>;
  /** Salva sem fechar (antes de anexar um arquivo); devolve a conta salva, ou null se falhou (já avisado). */
  onSalvarConta: (data: ContaInput, id: string | null) => Promise<Conta | null>;
  /** Envia (File) ou remove (null) o boleto/comprovante na hora; devolve a conta atualizada, ou null se falhou. */
  onArquivo: (c: Conta, tipo: ContaArquivoTipo, file: File | null) => Promise<Conta | null>;
  onCreateCategoria: (nome: string) => Promise<Categoria>;
  /** Junta boleto + comprovante já salvos; devolve a conta atualizada (null se falhou). */
  onJuntar: (c: Conta) => Promise<Conta | null>;
}

export default function ContaEditModal({ open, editing, categorias, onClose, onSave, onSalvarConta, onArquivo, onCreateCategoria, onJuntar }: Props) {
  const [form, setForm] = useState<ContaInput>(EMPTY);
  const [addingCategoria, setAddingCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCategoria, setSavingCategoria] = useState(false);
  /** Conta como está salva (arquivos inclusive); atualizada a cada envio sem resetar o formulário. */
  const [salvo, setSalvo] = useState<Conta | null>(null);
  /** Parte sendo enviada/removida agora (os botões de arquivo ficam travados enquanto isso). */
  const [ocupado, setOcupado] = useState<{ tipo: ContaArquivoTipo; acao: "envio" | "remocao" } | null>(null);
  const [removendo, setRemovendo] = useState<ContaArquivoTipo | null>(null);
  const [juntando, setJuntando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const downOnBackdrop = useRef(false);
  // Enquanto algo é salvo, o modal inteiro fica travado (campos, botões, fechar).
  const travadoRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setAddingCategoria(false);
    setNovaCategoria("");
    setSalvo(editing);
    setOcupado(null);
    setRemovendo(null);
    setJuntando(false);
    setSalvando(false);
    setForm(editing ? formDe(editing) : EMPTY);
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !travadoRef.current) onClose();
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
      notify.erro(e, "Erro ao criar a categoria.");
    } finally {
      setSavingCategoria(false);
    }
  };

  /** Valida o formulário; para anexar, o vencimento também é obrigatório (o nome do arquivo usa o mês e o ano). */
  const validar = (paraArquivo: boolean): boolean => {
    if (!form.categoria.trim()) {
      notify.aviso("Selecione ou adicione uma categoria.");
      return false;
    }
    if (!form.beneficiario.trim()) {
      notify.aviso("Informe o beneficiário.");
      return false;
    }
    if (paraArquivo && !nomePdfConta(form)) {
      notify.aviso("Informe o vencimento para anexar arquivos: o nome do PDF usa o mês e o ano dele.");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validar(false)) return;
    setSalvando(true);
    try {
      // O modal guarda a conta salva: uma conta nova criada ao anexar um arquivo é atualizada, não duplicada.
      await onSave(form, salvo?.id ?? null);
    } finally {
      setSalvando(false);
    }
  };

  /** Há campos alterados ainda não salvos (o nome do arquivo depende deles). */
  const formAlterado = !salvo || (Object.keys(EMPTY) as (keyof ContaInput)[]).some((k) => form[k] !== formDe(salvo)[k]);

  /** Envia ou remove a parte na hora; salva a conta antes se ela é nova ou tem campos alterados. */
  const aplicarArquivo = async (tipo: ContaArquivoTipo, file: File | null) => {
    setOcupado({ tipo, acao: file ? "envio" : "remocao" });
    try {
      let conta = salvo;
      if (!conta || formAlterado) {
        conta = await onSalvarConta(form, conta?.id ?? null);
        if (!conta) return;
        setSalvo(conta);
      }
      const updated = await onArquivo(conta, tipo, file);
      if (updated) setSalvo(updated);
    } finally {
      setOcupado(null);
    }
  };

  const pickArquivo = (tipo: ContaArquivoTipo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    const invalid = validateContaArquivo(file);
    if (invalid) {
      notify.aviso(`${CONTA_ARQUIVO_LABEL[tipo]}: ${invalid}`);
      return;
    }
    if (!validar(true)) return;
    void aplicarArquivo(tipo, file);
  };

  const nomeBoleto = nomePdfConta(form, "BOL");
  const nomeComprovante = nomePdfConta(form, "COMP");
  const travado = salvando || ocupado != null || juntando;
  travadoRef.current = travado;
  const fechar = () => {
    if (!travado) onClose();
  };

  const juntar = async () => {
    if (!salvo) return;
    setJuntando(true);
    try {
      const updated = await onJuntar(salvo);
      if (updated) setSalvo(updated);
    } finally {
      setJuntando(false);
    }
  };

  const renderArquivo = (tipo: ContaArquivoTipo) => {
    const label = CONTA_ARQUIVO_LABEL[tipo];
    const atual = salvo?.[tipo] ?? null;
    const inputId = `conta-arquivo-${tipo}`;
    const status = ocupado?.tipo === tipo ? (ocupado.acao === "envio" ? "Enviando…" : "Removendo…") : null;

    let info: React.ReactNode;
    if (status) {
      info = (
        <span className="arquivo-nome muted" role="status">
          <span className="spinner" aria-hidden="true" /> {status}
        </span>
      );
    } else if (atual) {
      const paginas = `${atual.paginas} pág.`;
      const onde = atual.arquivo ? atual.arquivo.nome : "no PDF único";
      info = (
        <span className="arquivo-nome" title={`${atual.nome} (${paginas}) — ${onde}`}>
          {atual.arquivo ? (
            <a href={contaParteUrl(salvo!.id, tipo)} target="_blank" rel="noopener noreferrer">
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
    } else {
      info = <span className="arquivo-nome muted">Nenhum arquivo</span>;
    }

    return (
      <div className="field" key={tipo}>
        <label htmlFor={inputId}>{label}</label>
        <div className="arquivo-field">
          {info}
          <div className="arquivo-actions">
            {atual && (
              <button type="button" className="btn ghost" onClick={() => setRemovendo(tipo)}>
                Remover
              </button>
            )}
            <label className={`btn ghost${travado ? " disabled" : ""}`} htmlFor={inputId} aria-disabled={travado}>
              {atual ? "Trocar" : "Anexar"}
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
        if (e.target === e.currentTarget && downOnBackdrop.current) fechar();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h3>{salvo ? "Editar conta" : "Nova conta"}</h3>
          <button className="icon-btn" onClick={fechar} disabled={travado} title="Fechar">
            ✕
          </button>
        </div>
        {/* fieldset disabled: trava todos os campos e botões de uma vez enquanto salva. */}
        <fieldset className="modal-body modal-fieldset" disabled={travado} aria-busy={travado}>
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
            PDF ou imagem (PNG/JPG) de até 8 MB cada, salvos assim que você escolhe o arquivo.{" "}
            {nomeBoleto && nomeComprovante ? (
              <>
                O boleto é salvo como <strong className="arquivo-pdf-nome">{nomeBoleto}</strong> e o comprovante como{" "}
                <strong className="arquivo-pdf-nome">{nomeComprovante}</strong>.
              </>
            ) : (
              "Informe o vencimento para definir o nome dos arquivos."
            )}{" "}
            {salvo?.pdf && (
              <>
                Os dois já estão juntos em <strong className="arquivo-pdf-nome">{salvo.pdf.nome}</strong>.{" "}
                <a href={contaPdfUrl(salvo.id)} target="_blank" rel="noopener noreferrer">
                  Abrir PDF
                </a>
              </>
            )}
          </p>
          {salvo && !salvo.pdf && (
            <div className="arquivo-juntar">
              <button type="button" className="btn primary" disabled={!salvo.boleto || !salvo.comprovante} onClick={juntar}>
                {juntando ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Juntando…
                  </>
                ) : (
                  "Juntar PDFs"
                )}
              </button>
              <span className="muted">
                {salvo.boleto && salvo.comprovante
                  ? "Gera um PDF único com o boleto e o comprovante e apaga os arquivos separados."
                  : "Anexe o boleto e o comprovante para juntar."}
              </span>
            </div>
          )}
        </fieldset>
        <div className="modal-foot">
          <button className="btn ghost" onClick={fechar} disabled={travado}>
            {salvo ? "Fechar" : "Cancelar"}
          </button>
          <button className="btn primary" disabled={travado} onClick={submit}>
            {salvando ? (
              <>
                <span className="spinner" aria-hidden="true" /> Salvando…
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={removendo != null}
        title={`Remover ${removendo ? CONTA_ARQUIVO_LABEL[removendo].toLowerCase() : ""}`}
        message={
          removendo &&
          (salvo?.pdf
            ? `Remover o ${CONTA_ARQUIVO_LABEL[removendo].toLowerCase()}? O PDF único é desfeito e a outra parte volta a ficar separada.`
            : `Remover o ${CONTA_ARQUIVO_LABEL[removendo].toLowerCase()} desta conta?`)
        }
        confirmLabel="Remover"
        onConfirm={async () => {
          const tipo = removendo;
          setRemovendo(null);
          if (tipo) await aplicarArquivo(tipo, null);
        }}
        onCancel={() => setRemovendo(null)}
      />
    </div>
  );
}

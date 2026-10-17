"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Categoria, Conta, ContaInput } from "@/lib/types";
import { mesLabel } from "@/lib/contasCompute";
import { anoDoArquivo, lerPlanilhaContas, separarDuplicadas, type AbaImportada } from "@/lib/contasPlanilha";

interface Props {
  open: boolean;
  /** Contas já cadastradas, para a prévia mostrar o que será pulado. */
  contas: Conta[];
  categorias: Categoria[];
  onClose: () => void;
  /** Importa as contas escolhidas; resolve quando terminar (os erros já são avisados por quem chama). */
  onConfirm: (contas: ContaInput[]) => Promise<void>;
}

interface Previa extends AbaImportada {
  novas: ContaInput[];
  duplicadas: number;
}

export default function ImportPlanilhaModal({ open, contas, categorias, onClose, onConfirm }: Props) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [abas, setAbas] = useState<AbaImportada[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const downOnBackdrop = useRef(false);
  const inputId = useId();
  const travado = lendo || importando;

  useEffect(() => {
    if (!open) return;
    setArquivo(null);
    setAbas(null);
    setSelecionados(new Set());
    setErro(null);
  }, [open]);

  const fechar = () => {
    if (!travado) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !travado) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, travado]);

  // Todas as abas de uma vez: uma conta cadastrada sem vencimento só absorve uma linha da planilha.
  const previa = useMemo<Previa[]>(() => {
    if (!abas) return [];
    const { duplicadas } = separarDuplicadas(abas.flatMap((a) => a.contas), contas);
    const repetidas = new Set(duplicadas);
    return abas.map((a) => ({ ...a, novas: a.contas.filter((c) => !repetidas.has(c)), duplicadas: a.contas.filter((c) => repetidas.has(c)).length }));
  }, [abas, contas]);

  if (!open) return null;

  const escolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setLendo(true);
    setErro(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const lidas = lerPlanilhaContas(bytes, { anoPadrao: anoDoArquivo(file.name), categorias: categorias.map((c) => c.nome) });
      if (lidas.length === 0) throw new Error("Nenhuma aba mensal encontrada (ex.: JAN, com o cabeçalho CATEGORIA, BENEFICIÁRIO...).");
      setArquivo(file.name);
      setAbas(lidas);
      // Marca de início só os meses que têm algo novo.
      const { novas } = separarDuplicadas(lidas.flatMap((a) => a.contas), contas);
      const comNovas = new Set(novas);
      setSelecionados(new Set(lidas.filter((a) => a.contas.some((c) => comNovas.has(c))).map((a) => a.aba)));
    } catch (err) {
      setArquivo(null);
      setAbas(null);
      setErro(err instanceof Error ? err.message : "Não foi possível ler a planilha.");
    } finally {
      setLendo(false);
    }
  };

  const alternar = (aba: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(aba)) n.delete(aba);
      else n.add(aba);
      return n;
    });

  const escolhidas = previa.filter((p) => selecionados.has(p.aba));
  const total = escolhidas.reduce((n, p) => n + p.novas.length, 0);

  const submit = async () => {
    if (total === 0) return;
    setImportando(true);
    try {
      // Manda as linhas das abas escolhidas; o servidor confere de novo o que já existe.
      await onConfirm(escolhidas.flatMap((p) => p.contas));
    } finally {
      setImportando(false);
    }
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
      <div className="modal" role="dialog" aria-label="Importar da planilha">
        <div className="modal-head">
          <h3>Importar da planilha</h3>
          <button className="icon-btn" onClick={fechar} disabled={travado} title="Fechar">
            ✕
          </button>
        </div>
        <fieldset className="modal-body modal-fieldset" disabled={travado} aria-busy={travado}>
          <p className="hint">
            Envie a planilha financeira (.xlsx) com uma aba por mês. Contas que já existem com o mesmo nome (beneficiário e identificação), valor e mês/ano não são
            importadas de novo. Meses que ainda não existem são criados.
          </p>
          <div className="field">
            <label htmlFor={inputId}>Planilha</label>
            <div className="arquivo-field">
              <span className={`arquivo-nome${arquivo ? "" : " muted"}`} role={lendo ? "status" : undefined}>
                {lendo ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Lendo planilha…
                  </>
                ) : (
                  (arquivo ?? "Nenhum arquivo")
                )}
              </span>
              <div className="arquivo-actions">
                <label className={`btn ghost${travado ? " disabled" : ""}`} htmlFor={inputId} aria-disabled={travado}>
                  {arquivo ? "Trocar" : "Escolher"}
                </label>
                <input
                  id={inputId}
                  className="arquivo-input"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={escolherArquivo}
                />
              </div>
            </div>
          </div>
          {erro && (
            <p className="import-erro" role="alert">
              {erro}
            </p>
          )}

          {previa.length > 0 && (
            <div className="field">
              <label>Meses</label>
              <ul className="import-meses">
                {previa.map((p) => (
                  <li key={p.aba}>
                    <label>
                      <input type="checkbox" checked={selecionados.has(p.aba)} disabled={p.novas.length === 0} onChange={() => alternar(p.aba)} />
                      <span className="import-mes">{mesLabel(p.mes)}</span>
                      <span className="muted">
                        {p.novas.length} nova(s)
                        {p.duplicadas > 0 && ` · ${p.duplicadas} já existe(m)`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
        <div className="modal-foot">
          <button className="btn ghost" onClick={fechar} disabled={travado}>
            Cancelar
          </button>
          <button className="btn primary" disabled={travado || total === 0} onClick={submit}>
            {importando ? (
              <>
                <span className="spinner" aria-hidden="true" /> Importando…
              </>
            ) : (
              `Importar ${total} conta(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

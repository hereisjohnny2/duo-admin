"use client";

import { useMemo } from "react";
import type { Conta } from "@/lib/types";
import { CONTA_ARQUIVO_LABEL, CONTA_ARQUIVO_TIPOS, CONTA_STATUSES, CONTA_STATUS_STYLE, contaArquivoUrl, fmt, formatDate, mesDeVencimento, mesLabel, parseBRL } from "@/lib/contasCompute";

interface Props {
  items: Conta[];
  search: string;
  mes: string; // "" = todos
  onSearchChange: (v: string) => void;
  onMesChange: (v: string) => void;
  onAdd: () => void;
  onDuplicateMes: () => void;
  onDuplicateConta: (c: Conta) => void;
  onEdit: (c: Conta) => void;
  onDelete: (c: Conta) => void;
  onStatusChange: (c: Conta, status: string) => void;
}

export default function ContaList({ items, search, mes, onSearchChange, onMesChange, onAdd, onDuplicateMes, onDuplicateConta, onEdit, onDelete, onStatusChange }: Props) {
  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) {
      const m = mesDeVencimento(c.vencimento);
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [items]);

  const f = search.trim().toLowerCase();

  const visible = useMemo(() => {
    return items
      .filter((c) => (mes ? mesDeVencimento(c.vencimento) === mes : true))
      .filter((c) => (f ? [c.categoria, c.beneficiario, c.identificacao, c.status, c.observacoes].some((v) => String(v).toLowerCase().includes(f)) : true))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [items, mes, f]);

  return (
    <section className="conta-list">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Buscar por categoria, beneficiário, status ou observação..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select className="filter-select" value={mes} onChange={(e) => onMesChange(e.target.value)} title="Filtrar por mês de vencimento">
          <option value="">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {mesLabel(m)}
            </option>
          ))}
        </select>
        <span className="count-pill">{visible.length} conta(s)</span>
        <div className="toolbar-actions">
          <button className="btn ghost" onClick={onDuplicateMes}>
            Duplicar mês
          </button>
          <button className="btn primary" onClick={onAdd}>
            + Nova conta
          </button>
        </div>
      </div>

      <div className="card">
        <table className="stack">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Beneficiário</th>
              <th>Identificação</th>
              <th>Vencimento</th>
              <th>Data de Débito</th>
              <th className="num">Saída</th>
              <th>Status</th>
              <th>Observações</th>
              <th>Arquivos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const sc = CONTA_STATUS_STYLE[c.status] ?? CONTA_STATUS_STYLE["Em Aberto"];
              const saida = parseBRL(c.saida);
              return (
                <tr key={c.id}>
                  <td data-label="Categoria">
                    <span className="badge" style={{ background: "#e2e8f0", color: "#334155" }}>
                      {c.categoria}
                    </span>
                  </td>
                  <td data-label="Beneficiário">{c.beneficiario}</td>
                  <td className="muted" data-label="Identificação">{c.identificacao || "—"}</td>
                  <td data-label="Vencimento">{formatDate(c.vencimento)}</td>
                  <td className="muted" data-label="Data de Débito">{formatDate(c.dataDebito)}</td>
                  <td className="num" data-label="Saída">{saida != null ? fmt(saida) : "—"}</td>
                  <td data-label="Status">
                    <select
                      className="st-select"
                      style={{ background: sc.bg, color: sc.fg }}
                      value={c.status}
                      title="Mudar status"
                      onChange={(e) => onStatusChange(c, e.target.value)}
                    >
                      {CONTA_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="obs" data-label="Observações">{c.observacoes}</td>
                  <td data-label="Arquivos">
                    {c.boleto || c.comprovante ? (
                      <span className="arquivo-links">
                        {CONTA_ARQUIVO_TIPOS.map((tipo) => {
                          const arquivo = c[tipo];
                          return (
                            arquivo && (
                              <a
                                key={tipo}
                                className="badge arquivo-link"
                                style={{ background: "#e0e7ff", color: "#3730a3" }}
                                href={contaArquivoUrl(c.id, tipo)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Abrir ${CONTA_ARQUIVO_LABEL[tipo].toLowerCase()}: ${arquivo.nome}`}
                              >
                                {CONTA_ARQUIVO_LABEL[tipo]}
                              </a>
                            )
                          );
                        })}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="acts">
                    <button className="icon-btn" title="Editar" onClick={() => onEdit(c)}>
                      ✎
                    </button>{" "}
                    <button className="icon-btn" title="Duplicar" onClick={() => onDuplicateConta(c)}>
                      ⧉
                    </button>{" "}
                    <button className="icon-btn danger" title="Excluir" onClick={() => onDelete(c)}>
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="status-msg">Nenhuma conta encontrada.</p>}
      </div>
    </section>
  );
}

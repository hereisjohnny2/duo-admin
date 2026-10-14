"use client";

import { useMemo, useState } from "react";
import type { AcordoInput } from "@/lib/types";
import { fmt, STATUS_STYLE, STATUSES, type Enriched } from "@/lib/compute";

interface Props {
  items: Enriched[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: () => void;
  onExport: () => void;
  onEdit: (a: Enriched) => void;
  onDelete: (a: Enriched) => void;
  onStatusChange: (a: Enriched, status: string) => void;
  onFieldChange: (a: Enriched, field: keyof AcordoInput, value: string) => void;
}

export default function DevedorList({ items, search, onSearchChange, onAdd, onExport, onEdit, onDelete, onStatusChange, onFieldChange }: Props) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const f = search.trim().toLowerCase();

  const groups = useMemo(() => {
    const g = new Map<string, Enriched[]>();
    for (const a of items) {
      const arr = g.get(a.devedor) ?? [];
      arr.push(a);
      g.set(a.devedor, arr);
    }
    return [...g.entries()]
      .map(([name, list]) => ({
        name,
        list,
        fin: list.filter((x) => x.open).reduce((s, x) => s + (x.finite ?? 0), 0),
        men: list.filter((x) => x.open).reduce((s, x) => s + (x.monthly ?? 0), 0),
      }))
      .sort((a, b) => b.fin + b.men - (a.fin + a.men));
  }, [items]);

  const toggle = (name: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const visible = groups
    .map((g) => ({
      ...g,
      shown: f
        ? g.list.filter((it) => [it.devedor, it.emitente, it.status, it.tipo, it.obs, it.anotacao, it.valorPago, it.periodo].some((v) => String(v).toLowerCase().includes(f)))
        : g.list,
    }))
    .filter((g) => g.shown.length > 0);

  return (
    <section className="devedor-list">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Buscar por devedor, emitente, status ou observação..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="count-pill">
          {visible.length} devedor(es){f ? " encontrado(s)" : ""}
        </span>
        <div className="toolbar-actions">
          <button className="btn primary" onClick={onAdd}>
            + Novo acordo
          </button>
          <button className="btn ghost" onClick={onExport}>
            Exportar
          </button>
        </div>
      </div>

      {visible.map((g) => {
        const isOpen = f !== "" || openSet.has(g.name);
        return (
          <div className={`dev-card${isOpen ? " open" : ""}`} key={g.name}>
            <div className="dev-head" onClick={() => toggle(g.name)}>
              <span className="dev-avatar">{g.name.trim().charAt(0).toUpperCase()}</span>
              <div>
                <div className="dev-name">{g.name}</div>
                <div className="dev-meta">{g.shown.length} acordo(s)</div>
              </div>
              <div className="dev-totals">
                <div className="big">{fmt(g.fin)}</div>
                <div className="small">{g.men ? fmt(g.men) + "/mês recorrente" : "a receber (fixo)"}</div>
              </div>
              <span className="chev">▶</span>
            </div>
            {isOpen && (
              <div className="dev-body">
                <table className="stack">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Emitente</th>
                      <th className="num">Valor Parcela</th>
                      <th className="num">Qtd</th>
                      <th className="num">Valor</th>
                      <th className="num">Pagas</th>
                      <th className="num">Valor Pago</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th>Observações</th>
                      <th>Anotação</th>
                      <th className="acts">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.shown.map((it) => {
                      const sc = STATUS_STYLE[it.status] ?? STATUS_STYLE.Pendente;
                      return (
                        <tr key={it.id}>
                          <td data-label="Tipo">{it.tipo}</td>
                          <td data-label="Emitente">{it.emitente || <span className="muted">—</span>}</td>
                          <td className="num" data-label="Valor Parcela">{it.valorParcela}</td>
                          <td className="num" data-label="Qtd">{it.qtd || "—"}</td>
                          <td className="num" data-label="Valor">
                            {it.finite != null ? fmt(it.finite) : it.monthly != null ? fmt(it.monthly) + "/mês" : "—"}
                          </td>
                          <td className="num editable-cell" data-label="Pagas">
                            <input
                              className="inline-input number-input"
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={it.parcelasPagas}
                              placeholder="0"
                              aria-label={`Parcelas pagas de ${it.devedor}`}
                              onBlur={(e) => onFieldChange(it, "parcelasPagas", e.target.value)}
                            />
                          </td>
                          <td className="num editable-cell" data-label="Valor Pago">
                            <input
                              className="inline-input money-input"
                              defaultValue={it.valorPago}
                              placeholder="R$ 0,00"
                              aria-label={`Valor pago de ${it.devedor}`}
                              onBlur={(e) => onFieldChange(it, "valorPago", e.target.value)}
                            />
                          </td>
                          <td data-label="Vencimento">
                            {it.vencimento || "—"}
                            {it.periodo && (
                              <>
                                <br />
                                <span className="muted">{it.periodo}</span>
                              </>
                            )}
                          </td>
                          <td data-label="Status">
                            <select
                              className="st-select"
                              style={{ background: sc.bg, color: sc.fg }}
                              value={it.status}
                              title="Mudar status"
                              onChange={(e) => onStatusChange(it, e.target.value)}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="obs" data-label="Observações">{it.obs}</td>
                          <td className="editable-cell" data-label="Anotação">
                            <input
                              className="inline-input note-input"
                              defaultValue={it.anotacao}
                              placeholder="Adicionar..."
                              aria-label={`Anotação de ${it.devedor}`}
                              onBlur={(e) => onFieldChange(it, "anotacao", e.target.value)}
                            />
                          </td>
                          <td className="acts">
                            <button className="icon-btn" title="Editar" onClick={() => onEdit(it)}>
                              ✎
                            </button>{" "}
                            <button className="icon-btn danger" title="Excluir" onClick={() => onDelete(it)}>
                              🗑
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {visible.length === 0 && <p className="status-msg">Nenhum acordo encontrado.</p>}
    </section>
  );
}

"use client";

import type { InventarioItem } from "@/lib/types";
import { CATEGORIAS, fmtQtd, statusOf, STATUS_STYLE, type InventarioSummary } from "@/lib/inventario";

const STATUS_FILTERS = ["Todos", "A repor", "Zerado", "OK"];

interface Props {
  items: InventarioItem[];
  summary: InventarioSummary;
  search: string;
  categoria: string;
  status: string;
  onSearchChange: (v: string) => void;
  onCategoriaChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onQtyChange: (item: InventarioItem, delta: number) => void;
  onAdd: () => void;
  onEdit: (item: InventarioItem) => void;
  onExport: () => void;
}

export default function ItemList({
  items,
  summary,
  search,
  categoria,
  status,
  onSearchChange,
  onCategoriaChange,
  onStatusChange,
  onQtyChange,
  onAdd,
  onEdit,
  onExport,
}: Props) {
  return (
    <section className="inv-list">
      <div className="kpis">
        <div className="kpi">
          <div className="label">Itens cadastrados</div>
          <div className="value">{summary.total}</div>
          <div className="sub">{summary.byCategoria.length} categoria(s)</div>
        </div>
        <div className="kpi green">
          <div className="label">Em estoque</div>
          <div className="value">{summary.ok}</div>
          <div className="sub">acima do mínimo</div>
        </div>
        <div className="kpi amber">
          <div className="label">A repor</div>
          <div className="value">{summary.repor}</div>
          <div className="sub">no limite do estoque mínimo</div>
        </div>
        <div className="kpi red">
          <div className="label">Zerado</div>
          <div className="value">{summary.zerado}</div>
          <div className="sub">sem saldo no galpão</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Buscar por produto, código, localização ou observação..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="count-pill">{items.length} item(ns)</span>
        <div className="toolbar-actions">
          <button className="btn primary" onClick={onAdd}>
            + Novo item
          </button>
          <button className="btn ghost" onClick={onExport}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="inv-filters">
        <div className="inv-chips" role="group" aria-label="Filtrar por categoria">
          {["Todas", ...CATEGORIAS].map((c) => (
            <button key={c} className={`inv-chip${categoria === c ? " active" : ""}`} onClick={() => onCategoriaChange(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="inv-chips" role="group" aria-label="Filtrar por status">
          {STATUS_FILTERS.map((s) => (
            <button key={s} className={`inv-chip small${status === s ? " active" : ""}`} onClick={() => onStatusChange(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="status-msg">Nenhum item encontrado. Ajuste a busca ou os filtros.</p>
      ) : (
        <div className="inv-grid">
          {items.map((item) => {
            const s = statusOf(item);
            const style = STATUS_STYLE[s];
            return (
              <article className={`inv-card ${s.toLowerCase()}`} key={item.id}>
                <div className="inv-card-body">
                  <button className="inv-card-main" onClick={() => onEdit(item)} title="Editar item">
                    <div className="inv-card-top">
                      <span className="inv-code">{item.codigo}</span>
                      <span className="inv-cat">{item.categoria}</span>
                    </div>
                    <div className="inv-produto">{item.produto}</div>
                    <div className="inv-meta">
                      <span className="badge" style={{ background: style.bg, color: style.fg }}>
                        {s}
                      </span>
                      {item.localizacao && <span className="muted">◉ {item.localizacao}</span>}
                      <span className="muted">mín {fmtQtd(item.estoqueMinimo)}</span>
                    </div>
                  </button>

                  <div className="inv-stepper">
                    <button className="icon-btn" onClick={() => onQtyChange(item, -1)} aria-label={`Diminuir ${item.produto}`}>
                      −
                    </button>
                    <div className="inv-qtd">
                      <span className="inv-qtd-n">{fmtQtd(item.quantidade)}</span>
                      <span className="inv-qtd-un">{item.unidade}</span>
                    </div>
                    <button className="icon-btn primary" onClick={() => onQtyChange(item, 1)} aria-label={`Aumentar ${item.produto}`}>
                      +
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

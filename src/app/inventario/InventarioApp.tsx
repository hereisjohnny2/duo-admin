"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventarioItem, InventarioItemInput } from "@/lib/types";
import { clampQtd, summarize, toCSV } from "@/lib/inventario";
import { notify } from "@/lib/notify";
import * as api from "@/lib/api";
import ItemList from "@/components/inventario/ItemList";
import Loading from "@/components/Loading";
import ItemModal from "@/components/inventario/ItemModal";
import ConfirmDialog from "@/components/ConfirmDialog";

/** Atraso antes de persistir cliques seguidos no +/- de um mesmo item. */
const QTY_FLUSH_MS = 500;

export default function InventarioApp() {
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<InventarioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [status, setStatus] = useState("Todos");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventarioItem | null>(null);

  // O flush do +/- lê sempre a última quantidade da tela, não a do clique.
  const itemsRef = useRef<InventarioItem[]>([]);
  const qtyTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const reload = useCallback(async () => {
    setItems(await api.getInventario());
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar o estoque."))
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    const timers = qtyTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const summary = useMemo(() => summarize(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoria !== "Todas" && item.categoria !== categoria) return false;

      const s = item.quantidade <= 0 ? "ZERADO" : item.quantidade <= item.estoqueMinimo ? "REPOR" : "OK";
      if (status === "A repor" && s === "OK") return false;
      if (status === "Zerado" && s !== "ZERADO") return false;
      if (status === "OK" && s !== "OK") return false;

      if (!q) return true;
      return [item.produto, item.codigo, item.categoria, item.localizacao, item.observacoes].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, search, categoria, status]);

  /* ---- Quantidade (+/-) ---- */

  const handleQtyChange = (item: InventarioItem, delta: number) => {
    const proxima = clampQtd(item.quantidade + delta);
    if (proxima === item.quantidade) return;

    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, quantidade: proxima } : i)));

    const pendente = qtyTimers.current.get(item.id);
    if (pendente) clearTimeout(pendente);

    qtyTimers.current.set(
      item.id,
      setTimeout(async () => {
        qtyTimers.current.delete(item.id);
        const atual = itemsRef.current.find((i) => i.id === item.id);
        if (!atual) return;
        try {
          const updated = await api.updateInventarioItem(item.id, { quantidade: atual.quantidade });
          setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        } catch (e) {
          notify.erro(e, "Erro ao atualizar a quantidade.");
          await reload().catch(() => undefined); // volta ao que está no banco
        }
      }, QTY_FLUSH_MS)
    );
  };

  /* ---- CRUD ---- */

  const handleSave = async (data: InventarioItemInput) => {
    try {
      if (editing) {
        const updated = await api.updateInventarioItem(editing.id, data);
        setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        notify.sucesso(`Item ${updated.codigo} atualizado.`);
      } else {
        const created = await api.createInventarioItem(data);
        setItems((list) => [...list, created].sort((a, b) => a.codigo.localeCompare(b.codigo)));
        notify.sucesso(`Item ${created.codigo} adicionado.`);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      notify.erro(e, "Erro ao salvar o item.");
    }
  };

  const handleDelete = (item: InventarioItem) => setPendingDelete(item);

  const confirmDelete = async () => {
    const item = pendingDelete;
    if (!item) return;
    try {
      await api.deleteInventarioItem(item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
      setPendingDelete(null);
      setModalOpen(false);
      setEditing(null);
      notify.sucesso(`Item ${item.codigo} removido.`);
    } catch (e) {
      notify.erro(e, "Erro ao remover o item.");
    }
  };

  const handleExport = () => {
    const blob = new Blob([toCSV(items)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "estoque-duo.csv";
    link.click();
    notify.sucesso("Estoque exportado em CSV.");
    URL.revokeObjectURL(url);
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: InventarioItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  return (
    <>
      <main>
        {loading && <Loading label="Carregando o estoque" />}
        {error && <p className="status-msg error">Erro: {error}</p>}

        {!loading && !error && (
          <ItemList
            items={filtered}
            summary={summary}
            search={search}
            categoria={categoria}
            status={status}
            onSearchChange={setSearch}
            onCategoriaChange={setCategoria}
            onStatusChange={setStatus}
            onQtyChange={handleQtyChange}
            onAdd={openNew}
            onEdit={openEdit}
            onExport={handleExport}
          />
        )}
      </main>


      <ItemModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Remover item"
        message={
          pendingDelete && (
            <>
              Remover <strong>{pendingDelete.produto}</strong> ({pendingDelete.codigo}) do estoque?
            </>
          )
        }
        confirmLabel="Remover"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

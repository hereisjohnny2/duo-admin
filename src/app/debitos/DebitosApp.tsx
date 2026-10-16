"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Acordo, AcordoInput, Parcela } from "@/lib/types";
import { computeUpcoming, enrich, normalizeMoney, summarize, type Enriched } from "@/lib/compute";
import * as api from "@/lib/api";
import Dashboard from "../../components/debitos/Dashboard";
import Loading from "../../components/Loading";
import DevedorList from "../../components/debitos/DevedorList";
import EditModal from "../../components/debitos/EditModal";
import ConfirmDialog from "../../components/ConfirmDialog";

type Tab = "dashboard" | "devedor";

export default function DebitosApp() {
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Acordo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Enriched | null>(null);
  
  const reload = useCallback(async () => {
    const [a, p] = await Promise.all([api.getAcordos(), api.getParcelas()]);
    setAcordos(a);
    setParcelas(p);
  }, []);
  
  useEffect(() => {
    reload()
    .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar os dados."))
    .finally(() => setLoading(false));
  }, [reload]);

  const enriched: Enriched[] = useMemo(() => acordos.map(enrich), [acordos]);
  const summary = useMemo(() => summarize(enriched), [enriched]);
  const upcoming = useMemo(() => computeUpcoming(parcelas), [parcelas]);

  /* ---- CRUD ---- */
  const handleSave = async (data: AcordoInput) => {
    const payload: AcordoInput = {
      ...data,
      valorParcela: normalizeMoney(data.valorParcela),
      valorTotal: normalizeMoney(data.valorTotal),
      valorPago: normalizeMoney(data.valorPago),
    };
    try {
      if (editing) {
        const updated = await api.updateAcordo(editing.id, payload);
        setAcordos((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await api.createAcordo(payload);
        setAcordos((list) => [...list, created]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  };

  const handleDelete = (a: Enriched) => setPendingDelete(a);

  const confirmDelete = async () => {
    const a = pendingDelete;
    if (!a) return;
    try {
      await api.deleteAcordo(a.id);
      setAcordos((list) => list.filter((x) => x.id !== a.id));
      setPendingDelete(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  };

  const handleStatus = async (a: Enriched, status: string) => {
    const prev = acordos;
    setAcordos((list) => list.map((x) => (x.id === a.id ? { ...x, status } : x))); // otimista
    try {
      await api.updateAcordo(a.id, { status });
    } catch (e) {
      setAcordos(prev); // reverte
      alert(e instanceof Error ? e.message : "Erro ao mudar status.");
    }
  };

  const handleFieldChange = async (a: Enriched, field: keyof AcordoInput, value: string) => {
    if (value === a[field]) return;
    const normalized = field === "valorPago" ? normalizeMoney(value) : value;
    const prev = acordos;
    setAcordos((list) => list.map((x) => (x.id === a.id ? { ...x, [field]: normalized } : x)));
    try {
      await api.updateAcordo(a.id, { [field]: normalized });
    } catch (e) {
      setAcordos(prev);
      alert(e instanceof Error ? e.message : "Erro ao atualizar a parcela.");
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(acordos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cheques-acordos.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: Enriched) => {
    const { finite: _f, monthly: _m, open: _o, ...raw } = a;
    void _f;
    void _m;
    void _o;
    setEditing(raw);
    setModalOpen(true);
  };

  return (
    <>
      <nav className="tabs">
        <button className={`tab-btn${tab === "dashboard" ? " active" : ""}`} onClick={() => setTab("dashboard")}>
          Dashboard
        </button>
        <button className={`tab-btn${tab === "devedor" ? " active" : ""}`} onClick={() => setTab("devedor")}>
          Por Devedor
        </button>
      </nav>

      <main>
        {loading && <Loading label="Carregando débitos" />}
        {error && <p className="status-msg error">Erro: {error}</p>}

        {!loading && !error && (
          <>
            {tab === "dashboard" && <Dashboard summary={summary} upcoming={upcoming} />}
            {tab === "devedor" && (
              <DevedorList
                items={enriched}
                search={search}
                onSearchChange={setSearch}
                onAdd={openNew}
                onExport={handleExport}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatus}
                onFieldChange={handleFieldChange}
              />
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir acordo"
        message={
          pendingDelete && (
            <>
              Excluir o acordo de <strong>{pendingDelete.devedor}</strong> ({pendingDelete.valorParcela || "sem valor"})?
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <EditModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </>
  );
}

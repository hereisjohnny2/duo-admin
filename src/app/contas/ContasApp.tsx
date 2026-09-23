"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Categoria, Conta, ContaInput } from "@/lib/types";
import { normalizeMoney } from "@/lib/compute";
import { fmt, mesDeVencimento, summarizeContas } from "@/lib/contasCompute";
import * as api from "@/lib/api";
import ContaList from "../../components/contas/ContaList";
import ContaEditModal from "../../components/contas/ContaEditModal";
import DuplicateMesModal from "../../components/contas/DuplicateMesModal";

export default function ContasApp() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conta | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const c of contas) {
      const m = mesDeVencimento(c.vencimento);
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [contas]);

  const reload = useCallback(async () => {
    const [c, cat] = await Promise.all([api.getContas(), api.getCategorias()]);
    setContas(c);
    setCategorias(cat);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar os dados."))
      .finally(() => setLoading(false));
  }, [reload]);

  const filtered = useMemo(() => (mes ? contas.filter((c) => mesDeVencimento(c.vencimento) === mes) : contas), [contas, mes]);
  const summary = useMemo(() => summarizeContas(filtered), [filtered]);

  /* ---- CRUD ---- */
  const handleSave = async (data: ContaInput) => {
    const payload: ContaInput = {
      ...data,
      saida: normalizeMoney(data.saida),
    };
    try {
      if (editing) {
        const updated = await api.updateConta(editing.id, payload);
        setContas((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await api.createConta(payload);
        setContas((list) => [...list, created]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  };

  const handleDelete = async (c: Conta) => {
    if (!confirm(`Excluir a conta "${c.beneficiario}" (${c.categoria})?`)) return;
    try {
      await api.deleteConta(c.id);
      setContas((list) => list.filter((x) => x.id !== c.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  };

  const handleStatus = async (c: Conta, status: string) => {
    const prev = contas;
    setContas((list) => list.map((x) => (x.id === c.id ? { ...x, status } : x))); // otimista
    try {
      await api.updateConta(c.id, { status });
    } catch (e) {
      setContas(prev); // reverte
      alert(e instanceof Error ? e.message : "Erro ao mudar status.");
    }
  };

  const handleCreateCategoria = async (nome: string) => {
    const categoria = await api.createCategoria(nome);
    setCategorias((list) => (list.some((c) => c.id === categoria.id) ? list : [...list, categoria].sort((a, b) => a.nome.localeCompare(b.nome))));
    return categoria;
  };

  const handleDuplicateConta = async (c: Conta) => {
    const { id: _id, ...rest } = c;
    void _id;
    try {
      const created = await api.createConta(rest);
      setContas((list) => [...list, created]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao duplicar a conta.");
    }
  };

  const handleDuplicateMes = async (mesOrigem: string, mesDestino: string) => {
    try {
      const novas = await api.duplicateContasMes(mesOrigem, mesDestino);
      if (novas.length === 0) {
        alert("Nenhuma conta encontrada no mês de origem.");
        return;
      }
      setContas((list) => [...list, ...novas]);
      setMes(mesDestino);
      setDuplicateOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao duplicar o mês.");
    }
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Conta) => {
    setEditing(c);
    setModalOpen(true);
  };

  return (
    <main>
      {loading && <p className="status-msg">Carregando dados da API…</p>}
      {error && <p className="status-msg error">Erro: {error}</p>}

      {!loading && !error && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="label">Total de Saídas</div>
              <div className="value">{fmt(summary.totalSaida)}</div>
              <div className="sub">{summary.nContas} conta(s)</div>
            </div>
            <div className="kpi amber">
              <div className="label">Em Aberto</div>
              <div className="value">{summary.emAberto}</div>
            </div>
            <div className="kpi">
              <div className="label">Atrasado</div>
              <div className="value">{summary.atrasado}</div>
            </div>
          </div>

          <ContaList
            items={contas}
            search={search}
            mes={mes}
            onSearchChange={setSearch}
            onMesChange={setMes}
            onAdd={openNew}
            onDuplicateMes={() => setDuplicateOpen(true)}
            onDuplicateConta={handleDuplicateConta}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatus}
          />
        </>
      )}

      <ContaEditModal
        open={modalOpen}
        editing={editing}
        categorias={categorias}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onCreateCategoria={handleCreateCategoria}
      />

      <DuplicateMesModal open={duplicateOpen} meses={meses} onClose={() => setDuplicateOpen(false)} onConfirm={handleDuplicateMes} />
    </main>
  );
}

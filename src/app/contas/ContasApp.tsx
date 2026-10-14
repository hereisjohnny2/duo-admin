"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Categoria, Conta, ContaInput } from "@/lib/types";
import { normalizeMoney } from "@/lib/compute";
import { CONTA_ARQUIVO_LABEL, CONTA_ARQUIVO_TIPOS, fmt, mesDeVencimento, summarizeContas } from "@/lib/contasCompute";
import * as api from "@/lib/api";
import ContaList from "../../components/contas/ContaList";
import ContaEditModal, { type ArquivosPendentes } from "../../components/contas/ContaEditModal";
import DuplicateMesModal from "../../components/contas/DuplicateMesModal";
import ConfirmDialog from "../../components/ConfirmDialog";

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
  const [pendingDelete, setPendingDelete] = useState<Conta | null>(null);
  /** Conta recém-duplicada: a lista rola até ela e a destaca por alguns segundos. */
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);

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
  /** Envia/remove o boleto e o comprovante depois que a conta já existe; devolve as mensagens de erro. */
  const applyArquivos = async (conta: Conta, arquivos: ArquivosPendentes): Promise<string[]> => {
    const erros: string[] = [];
    let atual = conta;
    for (const tipo of CONTA_ARQUIVO_TIPOS) {
      const pendente = arquivos[tipo];
      if (pendente === undefined || (pendente === null && !atual[tipo])) continue;
      try {
        atual = pendente ? await api.uploadContaArquivo(atual.id, tipo, pendente) : await api.deleteContaArquivo(atual.id, tipo);
        const updated = atual;
        setContas((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      } catch (e) {
        const acao = pendente ? "enviar" : "remover";
        erros.push(`Não foi possível ${acao} o ${CONTA_ARQUIVO_LABEL[tipo].toLowerCase()}: ${e instanceof Error ? e.message : "erro inesperado."}`);
      }
    }
    return erros;
  };

  const handleSave = async (data: ContaInput, arquivos: ArquivosPendentes) => {
    const payload: ContaInput = {
      ...data,
      saida: normalizeMoney(data.saida),
    };
    let saved: Conta;
    try {
      if (editing) {
        saved = await api.updateConta(editing.id, payload);
        setContas((list) => list.map((c) => (c.id === saved.id ? saved : c)));
      } else {
        saved = await api.createConta(payload);
        setContas((list) => [...list, saved]);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
      return;
    }

    setModalOpen(false);
    setEditing(null);
    const erros = await applyArquivos(saved, arquivos);
    if (erros.length) alert(`A conta foi salva, mas:\n${erros.join("\n")}`);
  };

  const confirmDelete = async () => {
    const c = pendingDelete;
    if (!c) return;
    try {
      await api.deleteConta(c.id);
      setContas((list) => list.filter((x) => x.id !== c.id));
      setPendingDelete(null);
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
    // O PDF não é copiado: boleto e comprovante são de cada pagamento.
    const { id: _id, boleto: _boleto, comprovante: _comprovante, pdf: _pdf, ...rest } = c;
    void _id;
    void _boleto;
    void _comprovante;
    void _pdf;
    try {
      const created = await api.createConta(rest);
      // Logo depois da original: com o mesmo vencimento, a ordenação (estável) mantém as duas juntas.
      setContas((list) => {
        const i = list.findIndex((x) => x.id === c.id);
        return i < 0 ? [...list, created] : [...list.slice(0, i + 1), created, ...list.slice(i + 1)];
      });
      setHighlightId(created.id);
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
            onDelete={setPendingDelete}
            highlightId={highlightId}
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

      <ConfirmDialog
        open={pendingDelete != null}
        title="Excluir conta"
        message={
          pendingDelete && (
            <>
              Excluir a conta <strong>{pendingDelete.beneficiario}</strong> ({pendingDelete.categoria})?
              {pendingDelete.pdf && " O PDF do boleto/comprovante também será apagado."}
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <DuplicateMesModal open={duplicateOpen} meses={meses} onClose={() => setDuplicateOpen(false)} onConfirm={handleDuplicateMes} />
    </main>
  );
}

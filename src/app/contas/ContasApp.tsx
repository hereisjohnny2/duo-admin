"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Categoria, Conta, ContaArquivoTipo, ContaInput } from "@/lib/types";
import { normalizeMoney } from "@/lib/compute";
import { CONTA_ARQUIVO_LABEL, fmt, mesDeVencimento, summarizeContas } from "@/lib/contasCompute";
import * as api from "@/lib/api";
import ContaList from "../../components/contas/ContaList";
import Loading from "../../components/Loading";
import ContaEditModal from "../../components/contas/ContaEditModal";
import DuplicateMesModal from "../../components/contas/DuplicateMesModal";
import ImportPlanilhaModal from "../../components/contas/ImportPlanilhaModal";
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
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conta | null>(null);
  /** Conta recém-duplicada: a lista rola até ela e a destaca por alguns segundos. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [juntandoId, setJuntandoId] = useState<string | null>(null);

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
  /** Cria (id null) ou atualiza a conta e reflete na lista; lança o erro da API. */
  const salvarConta = async (data: ContaInput, id: string | null): Promise<Conta> => {
    const payload: ContaInput = { ...data, saida: normalizeMoney(data.saida) };
    if (id) {
      const saved = await api.updateConta(id, payload);
      setContas((list) => list.map((c) => (c.id === saved.id ? saved : c)));
      return saved;
    }
    const saved = await api.createConta(payload);
    setContas((list) => [...list, saved]);
    return saved;
  };

  const handleSave = async (data: ContaInput, id: string | null) => {
    try {
      await salvarConta(data, id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
      return;
    }
    setModalOpen(false);
    setEditing(null);
  };

  /** Salva sem fechar o modal (antes de anexar um arquivo); devolve a conta, ou null se deu erro (já avisado). */
  const handleSalvarConta = async (data: ContaInput, id: string | null): Promise<Conta | null> => {
    try {
      return await salvarConta(data, id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar a conta.");
      return null;
    }
  };

  /** Envia (File) ou remove (null) o boleto/comprovante na hora; devolve a conta, ou null se deu erro (já avisado). */
  const handleArquivo = async (c: Conta, tipo: ContaArquivoTipo, file: File | null): Promise<Conta | null> => {
    try {
      const updated = file ? await api.uploadContaArquivo(c.id, tipo, file) : await api.deleteContaArquivo(c.id, tipo);
      setContas((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      return updated;
    } catch (e) {
      const acao = file ? "enviar" : "remover";
      alert(`Não foi possível ${acao} o ${CONTA_ARQUIVO_LABEL[tipo].toLowerCase()}: ${e instanceof Error ? e.message : "erro inesperado."}`);
      return null;
    }
  };

  /** Junta boleto + comprovante; devolve a conta atualizada, ou null se deu erro (já avisado). */
  const handleJuntar = async (c: Conta): Promise<Conta | null> => {
    setJuntandoId(c.id);
    try {
      const updated = await api.juntarContaArquivos(c.id);
      setContas((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      setHighlightId(updated.id);
      return updated;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao juntar os arquivos.");
      return null;
    } finally {
      setJuntandoId(null);
    }
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

  const handleImportPlanilha = async (lidas: ContaInput[]) => {
    try {
      const { importadas, ignoradas, categorias: novasCategorias } = await api.importContas(lidas);
      setContas((list) => [...list, ...importadas]);
      if (novasCategorias.length > 0) setCategorias((list) => [...list, ...novasCategorias].sort((a, b) => a.nome.localeCompare(b.nome)));
      // Mostra o mês mais recente que recebeu contas (se for um só, é exatamente ele).
      const meses = [...new Set(importadas.map((c) => mesDeVencimento(c.vencimento)))].sort();
      if (meses.length > 0) setMes(meses[meses.length - 1]);
      setImportOpen(false);
      const puladas = ignoradas > 0 ? ` ${ignoradas} já existia(m) e não foi(ram) importada(s).` : "";
      alert(`${importadas.length} conta(s) importada(s).${puladas}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao importar a planilha.");
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
      {loading && <Loading label="Carregando contas" />}
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
            onImportPlanilha={() => setImportOpen(true)}
            onDuplicateConta={handleDuplicateConta}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            onJuntar={handleJuntar}
            juntandoId={juntandoId}
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
        onSalvarConta={handleSalvarConta}
        onArquivo={handleArquivo}
        onCreateCategoria={handleCreateCategoria}
        onJuntar={handleJuntar}
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

      <ImportPlanilhaModal open={importOpen} contas={contas} categorias={categorias} onClose={() => setImportOpen(false)} onConfirm={handleImportPlanilha} />

      <DuplicateMesModal open={duplicateOpen} meses={meses} onClose={() => setDuplicateOpen(false)} onConfirm={handleDuplicateMes} />
    </main>
  );
}

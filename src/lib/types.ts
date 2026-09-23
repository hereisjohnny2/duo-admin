export type Status = "Pendente" | "Pago" | "Atrasado" | "Verificar" | "Encerrado";

export interface Acordo {
  id: string;
  devedor: string;
  emitente: string;
  tipo: string;
  valorParcela: string;
  qtd: string;
  valorTotal: string;
  parcelasPagas: string;
  valorPago: string;
  vencimento: string;
  periodo: string;
  status: string;
  obs: string;
  anotacao: string;
}

/** Dados enviados pelo cliente ao criar/editar (sem o id). */
export type AcordoInput = Omit<Acordo, "id">;

export interface Parcela {
  devedor: string;
  emitente: string;
  tipo: string;
  valor: string;
  data: string; // dd/mm/yyyy
  status: string;
}

export type ContaStatus = "Em Aberto" | "Pago" | "Atrasado";

export interface Categoria {
  id: string;
  nome: string;
}

export interface Conta {
  id: string;
  categoria: string;
  beneficiario: string;
  identificacao: string;
  vencimento: string; // yyyy-mm-dd
  dataDebito: string;
  saida: string; // valor (texto formatado em R$)
  status: string;
  observacoes: string;
}

/** Dados enviados pelo cliente ao criar/editar (sem o id). */
export type ContaInput = Omit<Conta, "id">;

export interface Database {
  acordos: Acordo[];
  parcelas: Parcela[];
  categorias: Categoria[];
  contas: Conta[];
}

export type InventarioStatus = "OK" | "REPOR" | "ZERADO";

export interface InventarioItem {
  id: string;
  codigo: string;
  produto: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  estoqueMinimo: number;
  localizacao: string;
  observacoes: string;
}

/** Dados enviados pelo cliente ao criar um item (o código é gerado no servidor). */
export type InventarioItemInput = Omit<InventarioItem, "id" | "codigo">;

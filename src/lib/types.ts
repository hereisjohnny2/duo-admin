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
  /** Boleto e comprovante anexados (null = parte ausente). */
  boleto: ContaParte | null;
  comprovante: ContaParte | null;
  /** PDF único com as duas partes, criado pelo botão "Juntar" (null = ainda separadas). */
  pdf: ContaPdf | null;
}

export type ContaArquivoTipo = "boleto" | "comprovante";

export interface ContaParte {
  /** Nome do arquivo que o usuário enviou. */
  nome: string;
  paginas: number;
  /** Arquivo próprio da parte no Storage (BOL_... ou COMP_...); null quando ela já está dentro do PDF único. */
  arquivo: ContaPdf | null;
}

export interface ContaPdf {
  /** Caminho do objeto no bucket do Storage. */
  path: string;
  /** <BOL|COMP>_<Categoria>_<Beneficiario>+<Identificacao>_<Mes>_<Ano>.pdf */
  nome: string;
}

/** Dados enviados pelo cliente ao criar/editar (sem o id; os arquivos têm rota própria). */
export type ContaInput = Omit<Conta, "id" | ContaArquivoTipo | "pdf">;

/** Resultado de "Importar da planilha". */
export interface ImportacaoContas {
  importadas: Conta[];
  /** Linhas não importadas porque a conta já existe (mesmo nome, valor e mês/ano). */
  ignoradas: number;
  /** Categorias cadastradas agora (as que a planilha usa e ainda não existiam). */
  categorias: Categoria[];
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

import { toast } from "react-toastify";

/* Avisos ao usuário (no lugar do alert() do navegador). Só roda no browser. */

/** Mensagem de um erro capturado, ou `fallback` se ele não tem uma. */
export function mensagemDeErro(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export const notify = {
  sucesso: (msg: string) => toast.success(msg),
  info: (msg: string) => toast.info(msg),
  /** Validação ou situação que o usuário precisa corrigir. */
  aviso: (msg: string) => toast.warning(msg),
  /** Falha de uma operação: mostra a mensagem do erro (vinda da API) ou `fallback`. */
  erro: (e: unknown, fallback = "Erro inesperado.") => toast.error(typeof e === "string" ? e : mensagemDeErro(e, fallback)),
};

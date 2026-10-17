/* =====================================================================
   Mensagens de erro em português. O Supabase (Auth, banco e Storage)
   responde em inglês; nada dele vai direto para a tela. Erros que não
   conhecemos viram uma mensagem genérica, e o original fica no log.
   Funções puras — rodam no cliente e no servidor.
   ===================================================================== */

interface ErroExterno {
  code?: string | number | null;
  status?: number | null;
  name?: string;
  message?: string;
}

/** Erros do Supabase Auth, pelo `code` que ele devolve. */
const AUTH: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Confirme seu e-mail antes de entrar.",
  user_not_found: "Usuário não encontrado.",
  user_banned: "Este usuário está bloqueado.",
  same_password: "A nova senha precisa ser diferente da senha atual.",
  weak_password: "Senha fraca. Use ao menos 6 caracteres, misturando letras e números.",
  email_address_invalid: "E-mail inválido.",
  validation_failed: "Confira os dados informados.",
  over_email_send_rate_limit: "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  otp_expired: "O link expirou. Solicite um novo.",
  flow_state_expired: "O link expirou. Solicite um novo.",
  session_not_found: "Sua sessão expirou. Solicite um novo link ou entre de novo.",
  session_expired: "Sua sessão expirou. Entre de novo.",
  refresh_token_not_found: "Sua sessão expirou. Entre de novo.",
  reauthentication_needed: "Entre de novo para alterar a senha.",
  signup_disabled: "O cadastro de novos usuários está desativado.",
  email_address_not_authorized: "Este e-mail não pode receber mensagens do sistema.",
  request_timeout: "O servidor demorou para responder. Tente de novo.",
};

/** Mensagem em português para um erro do Supabase Auth. */
export function mensagemErroAuth(erro: ErroExterno): string {
  const code = String(erro.code ?? "");
  if (AUTH[code]) return AUTH[code];
  // Falha de rede: o supabase-js marca com status 0 / AuthRetryableFetchError.
  if (erro.status === 0 || erro.name === "AuthRetryableFetchError") return ERRO_CONEXAO;
  if (erro.status === 429) return AUTH.over_request_rate_limit;
  return "Não foi possível concluir. Tente de novo em instantes.";
}

/** Erros do Postgres/PostgREST, pelo código (SQLSTATE ou PGRST...). */
const BANCO: Record<string, string> = {
  "23505": "Já existe um registro com esses dados.",
  "23503": "Este registro está ligado a outro e não pode ser alterado assim.",
  "23502": "Preencha os campos obrigatórios.",
  "23514": "Algum valor informado não é permitido.",
  "22P02": "Algum valor informado está em um formato inválido.",
  "22001": "Algum texto informado é longo demais.",
  PGRST116: "Registro não encontrado.",
};

/** Mensagem em português para um erro do banco. */
export function mensagemErroBanco(erro: ErroExterno): string {
  return BANCO[String(erro.code ?? "")] ?? "Erro ao acessar o banco de dados. Tente de novo.";
}

/** Erros do Supabase Storage, pela mensagem (ele não devolve um código estável). */
const STORAGE: [RegExp, string][] = [
  [/payload too large|exceeded the maximum allowed size|entity too large/i, "o arquivo é grande demais"],
  [/mime type .* is not supported|invalid mime/i, "o tipo de arquivo não é aceito"],
  [/already exists|duplicate/i, "já existe um arquivo com esse nome"],
  [/not found/i, "o arquivo não foi encontrado"],
];

/** Motivo em português (minúsculo, para compor "Falha ao enviar o arquivo: <motivo>."). */
export function motivoErroStorage(erro: ErroExterno): string {
  const msg = erro.message ?? "";
  return STORAGE.find(([re]) => re.test(msg))?.[1] ?? "erro no armazenamento de arquivos";
}

export const ERRO_CONEXAO = "Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.";

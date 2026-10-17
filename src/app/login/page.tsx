"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { mensagemErroAuth } from "@/lib/mensagensErro";
import DuoLogo from "@/components/DuoLogo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "link") {
      setError("Link inválido ou expirado. Solicite um novo abaixo.");
    }
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(mensagemErroAuth(error));
      setLoading(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(destination);
    router.refresh();
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createBrowserSupabase();
    // O template do e-mail monta o link a partir daqui ({{ .RedirectTo }}?token_hash=...), então ele
    // volta para o mesmo site em que o pedido foi feito (produção, preview ou localhost). A URL
    // precisa estar em Redirect URLs no Supabase; se não estiver, ele usa o Site URL.
    const redirectTo = `${window.location.origin}/auth/confirm`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (error) {
      setError(mensagemErroAuth(error));
      return;
    }
    setInfo("Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique sua caixa de entrada.");
  };

  const isLogin = mode === "login";

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={isLogin ? login : sendReset}>
        <DuoLogo className="login-logo" />
        <h1>Duo Painel Administrativo</h1>
        <p className="login-sub">{isLogin ? "Entre para acessar o painel" : "Recuperar acesso"}</p>

        <div className="field">
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
        </div>

        {isLogin && (
          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
        )}

        {error && <p className="login-error">{error}</p>}
        {info && <p className="login-info">{info}</p>}

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Aguarde…
            </>
          ) : isLogin ? (
            "Entrar"
          ) : (
            "Enviar link de recuperação"
          )}
        </button>

        {isLogin ? (
          <button
            type="button"
            className="login-link"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setInfo(null);
            }}
          >
            Esqueci a senha
          </button>
        ) : (
          <button
            type="button"
            className="login-link"
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
          >
            ← Voltar para o login
          </button>
        )}
      </form>
    </div>
  );
}

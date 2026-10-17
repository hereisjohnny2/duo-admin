"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { useSidebar } from "./AppSidebar";
import ModuleIcon, { type IconName } from "./ModuleIcon";

interface Props {
  title: string;
  subtitle: string;
  href?: string;
  /** Ícone do menu lateral para a página (módulo, início ou configurações). */
  icon?: IconName;
}

export default function AppHeader({ title, subtitle, href = "/", icon }: Props) {
  const router = useRouter();
  const sidebar = useSidebar();
  const [darkMode, setDarkMode] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("checks-app-theme") !== "light");
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data, error }) => {
        if (error && /jwt issued at future|issued at future/i.test(error.message)) {
          void createBrowserSupabase().auth.signOut();
          router.replace("/login");
          return;
        }

        setUserEmail(data.user?.email ?? null);
      })
      .catch(() => {
        // Sessão inválida ou em clock skew: limpar e mandar para login.
        void createBrowserSupabase().auth.signOut();
        router.replace("/login");
      });
  }, [router]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("checks-app-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const signOut = async () => {
    await createBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="top">
      <div className="top-inner">
        <div className="top-brand">
          {sidebar.available && (
            <button
              className="btn on-dark menu-toggle"
              onClick={sidebar.toggle}
              aria-label={sidebar.expanded ? "Recolher menu" : "Abrir menu"}
              aria-expanded={sidebar.expanded}
            >
              ☰
            </button>
          )}
          {icon && (
            <span className="top-icon">
              <ModuleIcon name={icon} fallback={title} />
            </span>
          )}
          <div>
            <h1>
              <Link className="brand-link" href={href}>
                {title}
              </Link>
            </h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="top-actions">
          {userEmail && <span className="top-user">{userEmail}</span>}
          <button className="btn on-dark theme-toggle" onClick={() => setDarkMode((value) => !value)}>
            {darkMode ? "Modo claro" : "Modo escuro"}
          </button>
          <Link className="btn on-dark" href="/configuracoes">
            Configurações
          </Link>
          <button className="btn on-dark" onClick={signOut}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

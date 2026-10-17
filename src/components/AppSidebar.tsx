"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import DuoLogo from "./DuoLogo";
import ModuleIcon, { type IconName } from "./ModuleIcon";
import { APP_MODULES, MODULES_CHANGED_EVENT, readModuleState, type ModuleId } from "@/lib/modules";

export const SIDEBAR_STORAGE_KEY = "checks-app-sidebar";

/** Abaixo desta largura o menu deixa de empurrar o conteúdo e vira uma gaveta. */
const MOBILE_QUERY = "(max-width: 820px)";

/** Telas sem sessão não mostram o menu. */
const isPublicRoute = (path: string) => path === "/login" || path === "/reset-password" || path.startsWith("/auth");

interface SidebarState {
  /** Há um menu nesta tela (false nas telas de login). */
  available: boolean;
  /** O menu está aberto no tamanho de tela atual. */
  expanded: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState>({ available: false, expanded: false, toggle: () => undefined });

export const useSidebar = () => useContext(SidebarContext);

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const available = !isPublicRoute(pathname);

  // No desktop o menu recolhe para uma faixa de ícones; no celular ele abre por cima da tela.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modules, setModules] = useState<Record<ModuleId, boolean>>(() => readModuleState());

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed");

    const media = window.matchMedia(MOBILE_QUERY);
    const onMedia = () => setIsMobile(media.matches);
    onMedia();
    media.addEventListener("change", onMedia);

    const onModules = () => setModules(readModuleState());
    onModules();
    window.addEventListener(MODULES_CHANGED_EVENT, onModules);

    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener(MODULES_CHANGED_EVENT, onModules);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "expanded" : "collapsed");
      return !value;
    });
  }, []);

  const expanded = isMobile ? mobileOpen : !collapsed;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const item = (href: string, icon: IconName, label: string) => (
    <Link className={`sidebar-link${isActive(href) ? " active" : ""}`} href={href} title={label} aria-current={isActive(href) ? "page" : undefined} key={href}>
      <span className="sidebar-icon">
        <ModuleIcon name={icon} fallback={label} />
      </span>
      <span className="sidebar-label">{label}</span>
    </Link>
  );

  return (
    <SidebarContext.Provider value={{ available, expanded, toggle }}>
      {available ? (
        <div className="app-layout">
          <nav className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`} aria-label="Menu principal">
            <div className="sidebar-head">
              <Link className="sidebar-label sidebar-brand" href="/" aria-label="DUO Arquitetura e Construção — Início">
                <DuoLogo className="sidebar-logo" />
              </Link>
              <button className="icon-btn sidebar-toggle" onClick={toggle} title={expanded ? "Recolher menu" : "Abrir menu"} aria-label={expanded ? "Recolher menu" : "Abrir menu"}>
                {expanded ? "‹" : "›"}
              </button>
            </div>

            {item("/", "home", "Início")}

            <span className="sidebar-label sidebar-section">Módulos</span>
            {Object.values(APP_MODULES)
              .filter((module) => modules[module.id])
              .map((module) => item(`/${module.slug}`, module.id, module.label))}

            <div className="sidebar-foot">{item("/configuracoes", "settings", "Configurações")}</div>
          </nav>
          {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
          <div className="app-content">{children}</div>
        </div>
      ) : (
        children
      )}
    </SidebarContext.Provider>
  );
}

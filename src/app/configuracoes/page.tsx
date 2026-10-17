"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_MODULES, readModuleState, saveModuleState, type ModuleId } from "@/lib/modules";
import AppHeader from "@/components/AppHeader";
import ModuleIcon from "@/components/ModuleIcon";
import { notify } from "@/lib/notify";

export default function ConfiguracoesPage() {
  const [modules, setModules] = useState<Record<ModuleId, boolean>>(() => readModuleState());

  // Salva fora do updater do setState: saveModuleState avisa o menu lateral, que se atualiza,
  // e o React roda updaters durante a renderização (atualizar outro componente ali é erro).
  const toggleModule = (id: ModuleId) => {
    const next = { ...modules, [id]: !modules[id] };
    setModules(next);
    saveModuleState(next);
    notify.sucesso(`Módulo ${APP_MODULES[id].label} ${next[id] ? "ativado" : "desativado"}.`);
  };

  return (
    <>
      <AppHeader title="Duo Painel Administrativo" subtitle="Organize os módulos disponíveis no seu painel." icon="settings" />

      <main className="settings-main">
        <div className="settings-heading">
          <div>
            <h2>Módulos</h2>
            <p>Ative somente as áreas que deseja usar agora.</p>
          </div>
          <span className="settings-count">{Object.keys(APP_MODULES).length} módulo disponíveis</span>
        </div>

        <section className="module-grid" aria-label="Módulos da aplicação">
          {Object.values(APP_MODULES).map((module) => (
            <article className={`module-card${modules[module.id] ? " enabled" : " disabled"}`} key={module.id}>
              <div className="module-card-icon">
                <ModuleIcon name={module.id} fallback={module.label} />
              </div>
              <div className="module-card-content">
                <div className="module-card-title-row">
                  <h3>{module.label}</h3>
                  <span className="module-status">{modules[module.id] ? "Ativo" : "Inativo"}</span>
                </div>
                <p>{module.description}</p>
                <Link className="module-route" href={`/${module.slug}`}>
                  /{module.slug}
                </Link>
              </div>
              <button
                className={`module-toggle${modules[module.id] ? " active" : ""}`}
                type="button"
                role="switch"
                aria-checked={modules[module.id]}
                aria-label={`${modules[module.id] ? "Desativar" : "Ativar"} módulo ${module.label}`}
                onClick={() => toggleModule(module.id)}
              >
                <span />
              </button>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

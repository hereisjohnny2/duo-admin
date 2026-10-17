"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { APP_MODULES, readModuleState, type ModuleId } from "@/lib/modules";
import AppHeader from "@/components/AppHeader";
import ModuleIcon from "@/components/ModuleIcon";

export default function Home() {
  const [modules, setModules] = useState<Record<ModuleId, boolean>>(() => readModuleState());

  useEffect(() => {
    setModules(readModuleState());
  }, []);

  const appModules = Object.values(APP_MODULES)

  return (
    <>
      <AppHeader title="Duo Painel Admin" subtitle="Escolha uma área para começar." icon="home" />

      <main className="home-main">
        <div className="settings-heading">
          <div>
            <h2>Módulos disponíveis</h2>
            <p>Acesse os módulos ativos ou gerencie sua disponibilidade.</p>
          </div>
          <span className="settings-count">{appModules.filter((module) => modules[module.id]).length} ativo(s)</span>
        </div>

        <section className="module-grid" aria-label="Módulos disponíveis">
          {appModules.map((module) => {
            const enabled = modules[module.id];
            return (
              <article className={`module-card home-module-card${enabled ? " enabled" : " disabled"}`} key={module.id}>
                <div className="module-card-icon">
                  <ModuleIcon name={module.id} fallback={module.label} />
                </div>
                <div className="module-card-content">
                  <div className="module-card-title-row">
                    <h3>{module.label}</h3>
                    <span className="module-status">{enabled ? "Ativo" : "Inativo"}</span>
                  </div>
                  <p>{module.description}</p>
                  {enabled ? (
                    <Link className="btn primary home-module-link" href={`/${module.slug}`}>
                      Abrir módulo
                    </Link>
                  ) : (
                    <span className="module-unavailable">Ative em Configurações</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </>
  );
}

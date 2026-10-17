"use client";

import { useEffect, useState } from "react";
import AppHeader from "./AppHeader";
import { APP_MODULES, readModuleState } from "@/lib/modules";

type AppShellProps = {
  children?: React.ReactNode
  moduleName: string
}

export default function AppShell({
  children,
  moduleName
}: AppShellProps) {
  const module = APP_MODULES[moduleName]
  const [moduleEnabled, setModuleEnabled] = useState(true);
  useEffect(() => {
    setModuleEnabled(readModuleState()[module.id]);
  }, []);
  return (
    <>
      <AppHeader title={module.label} subtitle={module.description} href={`/${module.slug}`} icon={module.id} />

      {moduleEnabled && children ? (
        children
      ) : (
        <main>
          <p className="status-msg">Este módulo está desativado.</p>
        </main>
      )}
    </>
  );
}

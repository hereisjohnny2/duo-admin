'use client'

import InventarioApp from "@/app/inventario/InventarioApp";
import AppShell from "@/components/AppShell";

export default function InventarioPage() {
  return (
    <AppShell moduleName="inventario">
      <InventarioApp />
    </AppShell>
  )
}

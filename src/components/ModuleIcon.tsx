import type { ModuleId } from "@/lib/modules";

export type IconName = ModuleId | "home" | "settings";

/** Traços de cada ícone, desenhados em uma grade 24x24. */
const ICONS: Partial<Record<string, React.ReactNode>> = {
  // Cédula
  debitos: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  // Recibo
  contas: (
    <>
      <path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5Z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  // Caixa
  inventario: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
  // Controles deslizantes
  settings: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
};

interface Props {
  name: IconName | string;
  /** Texto cuja inicial aparece quando o módulo ainda não tem ícone. */
  fallback?: string;
}

export default function ModuleIcon({ name, fallback = "" }: Props) {
  const icon = ICONS[name];
  if (!icon) return <>{fallback.charAt(0)}</>;

  return (
    <svg
      className="module-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

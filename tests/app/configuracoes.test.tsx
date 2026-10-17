import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfiguracoesPage from "@/app/configuracoes/page";
import AppSidebar from "@/components/AppSidebar";
import { readModuleState } from "@/lib/modules";

vi.mock("next/navigation", () => ({
  usePathname: () => "/configuracoes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase-browser", () => ({
  createBrowserSupabase: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }), signOut: vi.fn() } }),
}));

vi.mock("@/lib/notify", () => ({ notify: { sucesso: vi.fn(), info: vi.fn(), aviso: vi.fn(), erro: vi.fn() } }));

describe("ConfiguracoesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  });

  it("disables a module and updates the sidebar without updating it during render", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    // StrictMode (como no `next dev`) repete os updaters do setState durante a renderização.
    render(
      <StrictMode>
        <AppSidebar>
          <ConfiguracoesPage />
        </AppSidebar>
      </StrictMode>
    );
    expect(screen.getByRole("link", { name: /Inventário/ })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Desativar módulo Inventário" }));

    expect(readModuleState().inventario).toBe(false);
    expect(screen.queryByRole("link", { name: /^Inventário$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Ativar módulo Inventário" })).toHaveAttribute("aria-checked", "false");
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/Cannot update a component/);
    error.mockRestore();
  });
});

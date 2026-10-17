import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppHeader from "@/components/AppHeader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
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

describe("AppHeader", () => {
  it("shows the page icon next to the title", () => {
    const { container } = render(<AppHeader title="Contas" subtitle="Acompanhe contas" href="/contas" icon="contas" />);

    expect(screen.getByRole("link", { name: "Contas" })).toHaveAttribute("href", "/contas");
    expect(container.querySelector(".top-icon svg.module-icon")).toBeInTheDocument();
  });

  it("leaves the icon out when the page has none", () => {
    const { container } = render(<AppHeader title="Duo Painel Admin" subtitle="Escolha uma área" />);

    expect(container.querySelector(".top-icon")).toBeNull();
  });
});

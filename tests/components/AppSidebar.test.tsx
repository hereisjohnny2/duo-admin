import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppSidebar, { SIDEBAR_STORAGE_KEY, useSidebar } from "@/components/AppSidebar";
import { saveModuleState } from "@/lib/modules";

let pathname = "/";
let mobile = false;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function HeaderToggle() {
  const sidebar = useSidebar();
  return sidebar.available ? <button onClick={sidebar.toggle}>menu</button> : null;
}

function renderSidebar() {
  return render(
    <AppSidebar>
      <HeaderToggle />
      <p>conteúdo</p>
    </AppSidebar>
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    pathname = "/";
    mobile = false;
    window.localStorage.clear();
    window.matchMedia = vi.fn(() => ({
      matches: mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it("links to the home page, every enabled module and the settings", () => {
    pathname = "/contas";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /DUO Arquitetura/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Inventário/ })).toHaveAttribute("href", "/inventario");
    expect(screen.getByRole("link", { name: /Configurações/ })).toHaveAttribute("href", "/configuracoes");
    expect(screen.getByRole("link", { name: /Contas/ })).toHaveAttribute("aria-current", "page");
  });

  it("drops a module from the menu as soon as it is disabled", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Inventário/ })).toBeInTheDocument();

    act(() => saveModuleState({ contas: true, inventario: false }));

    expect(screen.queryByRole("link", { name: /Inventário/ })).not.toBeInTheDocument();
  });

  it("collapses and expands on desktop, remembering the choice", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(nav).not.toHaveClass("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(nav).toHaveClass("collapsed");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(nav).not.toHaveClass("collapsed");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("expanded");
  });

  it("opens as a drawer on phones and closes on the backdrop", () => {
    mobile = true;
    const { container } = renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(nav).not.toHaveClass("mobile-open");

    fireEvent.click(screen.getByRole("button", { name: "menu" }));
    expect(nav).toHaveClass("mobile-open");

    fireEvent.click(container.querySelector(".sidebar-backdrop")!);
    expect(nav).not.toHaveClass("mobile-open");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
  });

  it("stays out of the login screen", () => {
    pathname = "/login";
    renderSidebar();

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "menu" })).not.toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });
});

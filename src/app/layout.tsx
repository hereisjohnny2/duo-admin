import type { Metadata } from "next";
import AppSidebar from "@/components/AppSidebar";
import Toaster from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duo Painel Admin",
  description: "Painel administrativo modular.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <AppSidebar>{children}</AppSidebar>
        <Toaster />
      </body>
    </html>
  );
}

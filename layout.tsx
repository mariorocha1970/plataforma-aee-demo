import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "./auth-gate";

export const metadata: Metadata = {
  title: "Plataforma AEE — Demonstração protegida",
  description: "Demonstração com dados fictícios para análise, triangulação e redação em avaliação externa de escolas.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}

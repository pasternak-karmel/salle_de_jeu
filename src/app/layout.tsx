import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";

export const metadata: Metadata = {
  title: "GameZone — Gestion Salle de Jeu",
  description: "Gestion complète de votre salle de jeu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}

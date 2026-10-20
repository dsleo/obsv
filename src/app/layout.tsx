import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L’Observatoire — Actualité et intentions de vote",
  description: "Suivez l’évolution des intentions de vote et les événements qui comptent pour les électeurs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

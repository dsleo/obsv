import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { DemoBanner } from "../components/DemoBanner";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME } from "../lib/metadata";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  ...pageMetadata("Actualité et intentions de vote", SITE_DESCRIPTION),
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${newsreader.variable} ${plexSans.variable}`}>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}

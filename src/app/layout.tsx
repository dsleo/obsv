import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { SiteFooter } from "../components/SiteFooter";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/metadata";
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
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "./" },
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e7" },
    { media: "(prefers-color-scheme: dark)", color: "#101314" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${newsreader.variable} ${plexSans.variable}`}>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

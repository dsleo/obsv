import type { Metadata } from "next";

// Shared share/SEO fields. Pages override title and description; the site name and locale stay fixed.
export const SITE_NAME = "L’Observatoire";
export const SITE_DESCRIPTION = "Suivez l’évolution des intentions de vote et les événements qui comptent pour les électeurs.";

export function pageMetadata(title: string, description: string, type: "website" | "article" = "website"): Metadata {
  const fullTitle = `${title} — ${SITE_NAME}`;
  return {
    title: fullTitle,
    description,
    openGraph: { title: fullTitle, description, siteName: SITE_NAME, locale: "fr_FR", type },
    twitter: { card: "summary", title: fullTitle, description },
  };
}

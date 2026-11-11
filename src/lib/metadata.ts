import type { Metadata } from "next";

// Shared share/SEO fields. Pages override title and description; the site name and locale stay fixed.
export const SITE_NAME = "L’Observatoire";
export const SITE_DESCRIPTION =
  "Suivez l’évolution des intentions de vote et les événements qui comptent pour les électeurs.";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
/** Absolute base for canonical and share-image URLs: the GitHub Pages address on CI, localhost otherwise. */
export const SITE_URL =
  process.env.SITE_URL ||
  (owner && repo
    ? repo === `${owner}.github.io`
      ? `https://${owner}.github.io`
      : `https://${owner}.github.io/${repo}/`
    : "http://localhost:3000/");

const clip = (text: string, max = 160) =>
  text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;

export function pageMetadata(
  title: string,
  rawDescription: string,
  type: "website" | "article" = "website",
): Metadata {
  const fullTitle = `${title} — ${SITE_NAME}`;
  const description = clip(rawDescription);
  return {
    title: fullTitle,
    description,
    robots: {
      index: process.env.SITE_PUBLIC === "true",
      follow: process.env.SITE_PUBLIC === "true",
    },
    openGraph: {
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type,
      images: [{ url: "og.png", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: ["og.png"] },
  };
}

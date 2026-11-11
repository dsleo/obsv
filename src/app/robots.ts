import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/metadata";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(process.env.SITE_PUBLIC === "true" ? { allow: "/" } : { disallow: "/" }),
    },
    sitemap: new URL("sitemap.xml", SITE_URL.endsWith("/") ? SITE_URL : `${SITE_URL}/`).href,
  };
}

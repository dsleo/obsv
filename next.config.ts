import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repository = process.env.GITHUB_REPOSITORY ?? "";
const [owner, repo] = repository.split("/");
const isProjectSite = Boolean(owner && repo && repo !== `${owner}.github.io`);
const customPath = process.env.SITE_URL ? new URL(process.env.SITE_URL).pathname.replace(/\/$/, "") : undefined;
const basePath = process.env.SITE_BASE_PATH ?? customPath ?? (process.env.GITHUB_ACTIONS === "true" && isProjectSite ? `/${repo}` : "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: rootDir,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
};

export default nextConfig;

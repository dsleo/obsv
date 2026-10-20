import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repository = process.env.GITHUB_REPOSITORY ?? "";
const [owner, repo] = repository.split("/");
const isProjectSite = Boolean(owner && repo && repo !== `${owner}.github.io`);
const basePath = process.env.GITHUB_ACTIONS === "true" && isProjectSite ? `/${repo}` : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: rootDir,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GITHUB_PAGES === "true" ? "export" : undefined,
  basePath: process.env.GITHUB_PAGES === "true" ? "/BJJob" : "",
  assetPrefix: process.env.GITHUB_PAGES === "true" ? "/BJJob/" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;

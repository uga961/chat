import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

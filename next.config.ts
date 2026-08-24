import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "fs/promises": "./lib/browser/node-fs-unavailable.ts",
      fs: "./lib/browser/node-fs-unavailable.ts",
    },
  },
};

export default nextConfig;

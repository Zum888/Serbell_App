import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
    },
  },
  turbopack: {
    resolveAlias: {
      "./identity.dev.js": "./cursor/identity.dev.ts",
      "./identity.js": "./cursor/identity.ts",
    },
  },
};

export default nextConfig;

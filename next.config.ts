import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["bcryptjs"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals;
      config.externals = Array.isArray(externals)
        ? [...externals, "node:sqlite"]
        : externals
          ? [externals, "node:sqlite"]
          : ["node:sqlite"];
    }
    return config;
  },
};

export default nextConfig;

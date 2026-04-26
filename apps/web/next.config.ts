import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@synapse/shared"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Stellar SDK ships some node-only deps; mark them external on edge.
  serverExternalPackages: ["@stellar/stellar-sdk"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "stellar.expert" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default config;

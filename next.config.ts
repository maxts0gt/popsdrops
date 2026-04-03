import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "popsdrops.com",
        "www.popsdrops.com",
        "*.vercel.app",
      ],
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

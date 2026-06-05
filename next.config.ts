import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {},
  experimental: {
    globalNotFound: true,
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:4000",
        "127.0.0.1:3000",
        "127.0.0.1:4000",
        "popsdrops.com",
        "www.popsdrops.com",
        "*.vercel.app",
      ],
    },
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins ??= [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );
      config.resolve ??= {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        https: false,
        os: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ztllcbrczuygemeyfbxl.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    instantNavigationDevToolsToggle: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.devtool = 'eval';
    }
    return config;
  },
};

export default nextConfig;

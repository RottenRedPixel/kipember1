import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.dream.clubmed",
      },
    ],
  },
};

export default nextConfig;

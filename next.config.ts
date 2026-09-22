import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Token icons served by Tessera themselves, surfaced through
        // Jupiter's token metadata API (see src/lib/jupiter.ts).
        protocol: "https",
        hostname: "cdn.tesseralab.co",
      },
    ],
  },
};

export default nextConfig;

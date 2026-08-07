import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // T7 / macOS AppleDouble (`._*`) sidecars break the Next image optimizer —
  // it sometimes serves the 4KB resource-fork file instead of the JPEG.
  // Serve static files directly (same as HomeHero).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

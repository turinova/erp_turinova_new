import type { NextConfig } from "next";

/**
 * T7 / macOS AppleDouble (`._*`) fájlok: a watcher újrafordítást triggerelhet.
 * Ne használj abszolút `distDir`-t — a Next relatívnak veszi → pl. `Users/...` a repo-ban,
 * ami végtelen compile + böngésző reload loopot okoz.
 */
const nextConfig: NextConfig = {
  distDir: ".next",
  // Next 16 default = Turbopack; keep webpack watchOptions for T7 AppleDouble.
  turbopack: {},
  // pg uses Node `fs` — do not webpack-bundle it (instrumentation + API).
  serverExternalPackages: ["pg", "pg-native", "pg-connection-string"],
  async headers() {
    return [
      {
        source: "/widget.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (isServer) {
      const extra = ["pg", "pg-native", "pg-connection-string"];
      const prev = config.externals;
      config.externals = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        ...extra,
      ];
    }
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/Users/**",
          "**/._*",
          "**/.DS_Store",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;

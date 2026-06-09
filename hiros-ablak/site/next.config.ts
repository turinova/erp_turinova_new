import type { NextConfig } from "next"
import { LEGACY_REDIRECTS } from "./src/lib/redirects"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xgkaviefifbllbmfbyfe.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({
      source: r.source,
      destination: r.destination,
      permanent: r.permanent ?? true,
    }))
  },
}

export default nextConfig

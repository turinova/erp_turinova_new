import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Külső meghajtón (T7) a macOS ._ fájlok sérítik a Turbopack cache DB-t
    turbopackFileSystemCacheForDev: false,
  },
}

export default nextConfig

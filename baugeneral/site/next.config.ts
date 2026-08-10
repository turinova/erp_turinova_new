import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
]

const nextConfig: NextConfig = {
  // Local T7 / macOS AppleDouble (`._*`) can break the optimizer.
  // On Vercel there are no sidecars — enable optimization in production.
  images: {
    unoptimized: process.env.VERCEL !== "1",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: "/szolgaltatasok/tarshazak",
        destination: "/szolgaltatasok/ipari-epuletek",
        permanent: true,
      },
      {
        source: "/garancia-es-felelosseg",
        destination: "/aszf",
        permanent: true,
      },
    ]
  },
}

export default nextConfig

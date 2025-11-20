import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during builds (we can enable it later if needed)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail build on type errors (but we should fix them)
    ignoreBuildErrors: false,
  },
}

export default nextConfig


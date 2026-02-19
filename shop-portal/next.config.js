/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds to avoid config issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow TypeScript errors during build (we'll fix them gradually)
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig

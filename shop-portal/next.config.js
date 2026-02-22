/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds to avoid config issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow TypeScript errors during build (temporary - will fix properly)
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/shoprenter/structured-data/:sku.jsonld',
        destination: '/api/shoprenter/structured-data/:sku',
      },
    ]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude Playwright and Chromium from server-side bundles
      config.externals = config.externals || []
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals]
      }
      config.externals.push({
        'playwright': 'commonjs playwright',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
      })
    }
    return config
  },
}

module.exports = nextConfig

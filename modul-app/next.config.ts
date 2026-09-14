import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      puppeteer: false,
      'puppeteer-core': false,
      '@sparticuz/chromium': false
    }

    if (isServer) {
      if (!config.externals) {
        config.externals = []
      } else if (!Array.isArray(config.externals)) {
        config.externals = [config.externals]
      }

      config.externals.push({
        puppeteer: 'commonjs puppeteer',
        'puppeteer-core': 'commonjs puppeteer-core',
        '@sparticuz/chromium': 'commonjs @sparticuz/chromium'
      })
    }

    return config
  }
}

export default nextConfig

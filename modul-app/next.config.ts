import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // A repo külső (exFAT) köteten van, ahol a macOS `._` kísérőfájlokat ír a
    // kép-cache mappáiba, és az optimalizáló azokat szolgálja ki kép helyett.
    // Fejlesztésben ezért az eredeti fájl megy ki; a build/prod nem érinti.
    unoptimized: process.env.NODE_ENV === 'development'
  },
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

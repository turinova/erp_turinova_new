import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

const modulAppRoot = path.dirname(fileURLToPath(import.meta.url))
const zebrashCoreRoot = path.join(
  modulAppRoot,
  'node_modules',
  '@zebrash',
  'core'
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ZPL preview — ESM packages; force browser platform (see webpack plugins below)
  transpilePackages: ['@zebrash/browser', '@zebrash/core'],
  images: {
    // A repo külső (exFAT) köteten van, ahol a macOS `._` kísérőfájlokat ír a
    // kép-cache mappáiba, és az optimalizáló azokat szolgálja ki kép helyett.
    // Fejlesztésben ezért az eredeti fájl megy ki; a build/prod nem érinti.
    unoptimized: process.env.NODE_ENV === 'development'
  },
  webpack: (config, { isServer, webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      puppeteer: false,
      'puppeteer-core': false,
      '@sparticuz/chromium': false
    }

    // @zebrash/core package.json "browser" field is ignored under transpilePackages —
    // always force OffscreenCanvas platform (preview is client-only; never needs napi canvas).
    const platformBrowser = path.join(
      zebrashCoreRoot,
      'dist/platform-browser.js'
    )
    const platformBrowserImpl = path.join(
      zebrashCoreRoot,
      'dist/platform/browser.js'
    )
    const fontsBrowser = path.join(
      zebrashCoreRoot,
      'dist/assets/fonts-browser.js'
    )
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.join(zebrashCoreRoot, 'dist/platform.js')]: platformBrowser,
      [path.join(zebrashCoreRoot, 'dist/platform/node.js')]: platformBrowserImpl,
      [path.join(zebrashCoreRoot, 'dist/assets/fonts.js')]: fontsBrowser,
      '@napi-rs/canvas': path.join(modulAppRoot, 'stubs/empty-module.js')
    }
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /@zebrash[\\/]core[\\/]dist[\\/]platform\.js$/,
        platformBrowser
      ),
      new webpack.NormalModuleReplacementPlugin(
        /@zebrash[\\/]core[\\/]dist[\\/]platform[\\/]node\.js$/,
        platformBrowserImpl
      ),
      new webpack.NormalModuleReplacementPlugin(
        /@zebrash[\\/]core[\\/]dist[\\/]assets[\\/]fonts\.js$/,
        fontsBrowser
      )
    )

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

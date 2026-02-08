import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // basePath: process.env.BASEPATH, // Temporarily disabled for custom domain testing
  
  // Disable ESLint during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable CSS source maps in development to prevent console warnings
  productionBrowserSourceMaps: false,
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Headers for CDN and caching
  async headers() {
    return [
      // Static assets caching
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/brands/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      {
        source: '/api/materials/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // Brand detail pages caching
      {
        source: '/brands/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Materials pages caching
      {
        source: '/materials/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Units API routes caching
      {
        source: '/api/units/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // Units pages caching
      {
        source: '/units/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Currencies API routes caching
      {
        source: '/api/currencies/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // Currencies pages caching
      {
        source: '/currencies/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // VAT API routes caching
      {
        source: '/api/vat/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // VAT pages caching
      {
        source: '/vat/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Customers API routes caching
      {
        source: '/api/customers/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300', // 5 minutes
          },
        ],
      },
      // Customers pages caching
      {
        source: '/customers/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60', // 1 minute
          },
        ],
      },
      // Security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  
  // Compression and optimization
  experimental: {
    // optimizeCss: true, // Disabled - causing MUI syntax errors
    // optimizePackageImports: ['@mui/material', '@mui/icons-material'], // Disabled - might cause MUI issues
  },
  
  // REMOVED: serverComponentsExternalPackages - not supported in Next.js 15.1.9
  // Using webpack externals instead (see webpack config below)
  
  // Webpack configuration to disable source maps and prevent Puppeteer analysis
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.devtool = false
    }
    
    // CRITICAL: Exclude Puppeteer from ALL bundles (client AND server)
    // This prevents Next.js from analyzing these massive packages during build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'puppeteer': false,
        'puppeteer-core': false,
        '@sparticuz/chromium': false,
        'chrome-aws-lambda': false,
        'pdfkit': false,
        'svg-to-pdfkit': false,
        'pdf-lib': false,
      }
    
    // CRITICAL: Mark Puppeteer as external for server-side builds
    // This tells webpack to NOT bundle or analyze these packages at all
    if (isServer) {
      if (!config.externals) {
        config.externals = []
      } else if (!Array.isArray(config.externals)) {
        config.externals = [config.externals]
      }
      
        config.externals.push({
          'puppeteer': 'commonjs puppeteer',
          'puppeteer-core': 'commonjs puppeteer-core',
          '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
          'chrome-aws-lambda': 'commonjs chrome-aws-lambda',
          'pdfkit': 'commonjs pdfkit',
          'svg-to-pdfkit': 'commonjs svg-to-pdfkit',
          'pdf-lib': 'commonjs pdf-lib',
        })
    }
    
    return config
  },
  
  // redirects: async () => {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/home',
  //       permanent: true,
  //       locale: false
  //     }
  //   ]
  // }
}

export default nextConfig

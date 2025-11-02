import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  output: 'standalone',
  transpilePackages: [
    '@mui/material',
    '@mui/lab',
    '@mui/x-date-pickers'
  ]
}

export default nextConfig

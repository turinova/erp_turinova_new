import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A historikus gyertyafájl (RVOL + backtest) bekerüljön a serverless
  // function bundle-be a Vercelen is
  outputFileTracingIncludes: {
    "/api/live": ["./data/**"],
    "/api/cron": ["./data/**"],
    "/api/backtest": ["./data/**"],
  },
}

export default nextConfig

import os from "os"
import path from "path"
import type { NextConfig } from "next"

/**
 * T7 / külső köteten a macOS AppleDouble (`._*`) fájlok tönkreteszik a
 * Turbopack persistence DB-t ("invalid digit found in string").
 * Mindig helyi ~/.cache — a package.json symlinkeli ide a .next-et.
 */
export const LOCAL_DIST_DIR = path.join(os.homedir(), ".cache", "trading-app-next")

const onExternalVolume = process.cwd().startsWith("/Volumes/")
const distDir =
  process.env.NEXT_DIST_DIR ||
  (onExternalVolume ? LOCAL_DIST_DIR : ".next")

const nextConfig: NextConfig = {
  distDir,
  // A historikus gyertyafájl (RVOL + backtest) bekerüljön a serverless
  // function bundle-be a Vercelen is
  outputFileTracingIncludes: {
    "/api/live": ["./data/**"],
    "/api/cron": ["./data/**"],
    "/api/backtest": ["./data/**"],
  },
}

export default nextConfig

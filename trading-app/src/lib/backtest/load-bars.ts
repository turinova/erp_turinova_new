import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { BarFile } from "./types"

let cached: BarFile | null = null

/** A letöltött gyertyafájl beolvasása (memóriában cache-elve). */
export async function loadBars(): Promise<BarFile | null> {
  if (cached) return cached
  try {
    const raw = await readFile(
      join(process.cwd(), "data", "bars-NQ-5m.json"),
      "utf-8"
    )
    cached = JSON.parse(raw) as BarFile
    return cached
  } catch {
    return null
  }
}

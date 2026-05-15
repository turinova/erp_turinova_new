export type ParsedQuery = {
  text: string
  dims?: { length?: number; width?: number; thickness?: number }
  thicknessMm?: number
}

function toInt(s: string) {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parses Hungarian user input like:
 * - "2800x2070"
 * - "2800x2070x18"
 * - "18mm"
 * - "egger h1180 2800x2070"
 *
 * Returns remaining text tokens for ilike matching.
 */
export function parseButorlapQuery(raw: string | undefined): ParsedQuery {
  const q = (raw || "").trim()
  if (!q) return { text: "" }

  let rest = q
  let thicknessMm: number | undefined
  const dims: { length?: number; width?: number; thickness?: number } = {}

  // thickness like "18mm" or "18 mm"
  const mm = rest.match(/(^|\s)(\d{1,3})\s*mm(\s|$)/i)
  if (mm?.[2]) {
    thicknessMm = toInt(mm[2])
    rest = rest.replace(mm[0], " ").trim()
  }

  // dimensions like "2800x2070" or "2800×2070×18"
  const dim = rest.match(/(\d{3,5})\s*[x×]\s*(\d{3,5})(?:\s*[x×]\s*(\d{1,3}))?/i)
  if (dim) {
    const a = toInt(dim[1])
    const b = toInt(dim[2])
    const c = dim[3] ? toInt(dim[3]) : undefined
    // We don't know which is length/width; keep both and match either orientation.
    dims.length = a
    dims.width = b
    if (c) dims.thickness = c
    rest = rest.replace(dim[0], " ").trim()
  }

  return { text: rest, dims: Object.keys(dims).length ? dims : undefined, thicknessMm }
}


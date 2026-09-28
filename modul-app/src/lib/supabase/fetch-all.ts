/** A Supabase PostgREST alapból legfeljebb 1000 sort ad vissza kérésenként (`max_rows`). */
const PAGE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Tartomány-lapozás `max` sorig. A `page` builderben stabil `order` kell (pl. `id`),
 * különben lapok között sor ismétlődhet / kimaradhat.
 * `concurrency` > 1: ennyi lapot kér egyszerre (nagy táblákhoz; az első rövid lapnál megáll).
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  max: number,
  concurrency = 1
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = []
  const width = Math.max(1, Math.floor(concurrency))
  for (let from = 0; from < max; from += PAGE * width) {
    const ranges: [number, number][] = []
    for (let i = 0; i < width; i++) {
      const start = from + i * PAGE
      if (start >= max) break
      ranges.push([start, Math.min(start + PAGE, max) - 1])
    }
    const results = await Promise.all(ranges.map(([a, b]) => page(a, b)))
    for (let i = 0; i < results.length; i++) {
      const { data, error } = results[i]
      if (error) return { data: out, error: error.message }
      const rows = data ?? []
      out.push(...rows)
      const [a, b] = ranges[i]
      if (rows.length < b - a + 1) return { data: out, error: null }
    }
  }
  return { data: out, error: null }
}

/** ~100 uuid fér biztonságosan egy `.in()` URL-be (a hosszabb kérés 400 Bad Request). */
const ID_CHUNK = 100
const ID_CONCURRENCY = 6

/**
 * `.in(col, ids)` sok azonosítóra: darabolva (URL-hossz) és darabonként lapozva (`max_rows`).
 * A `page` builderben stabil `order` kell.
 */
export async function fetchByIds<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
  maxPerChunk = 50000
): Promise<{ data: T[]; error: string | null }> {
  const unique = [...new Set(ids.filter(Boolean))]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += ID_CHUNK) chunks.push(unique.slice(i, i + ID_CHUNK))
  const out: T[] = []
  for (let i = 0; i < chunks.length; i += ID_CONCURRENCY) {
    const results = await Promise.all(
      chunks
        .slice(i, i + ID_CONCURRENCY)
        .map((c) => fetchAllPages<T>((from, to) => page(c, from, to), maxPerChunk))
    )
    for (const r of results) {
      if (r.error) return { data: out, error: r.error }
      out.push(...r.data)
    }
  }
  return { data: out, error: null }
}

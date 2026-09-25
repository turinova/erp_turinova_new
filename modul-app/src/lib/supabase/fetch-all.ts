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

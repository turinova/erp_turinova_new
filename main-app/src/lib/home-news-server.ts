import { supabaseServer } from '@/lib/supabase-server'

export type HomeNewsKind = 'news' | 'task'

export interface HomeNewsPost {
  id: string
  title: string
  body: string | null
  kind: HomeNewsKind
  link_url: string | null
  link_label: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

const HOME_NEWS_LIMIT = 8
const HOME_NEWS_SELECT =
  'id, title, body, kind, link_url, link_label, is_active, created_by, created_at, updated_at'

function normalizeKind(value: unknown): HomeNewsKind {
  return value === 'task' ? 'task' : 'news'
}

/** Tasks first, then newest within each kind. */
export function sortHomeNewsPosts(posts: HomeNewsPost[]): HomeNewsPost[] {
  return [...posts].sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === 'task') return -1
      if (b.kind === 'task') return 1
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export async function getHomeNewsPosts(): Promise<HomeNewsPost[]> {
  if (!supabaseServer) return []

  const { data, error } = await supabaseServer
    .from('home_news_posts')
    .select(HOME_NEWS_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(HOME_NEWS_LIMIT)

  if (error) {
    console.error('[home-news] fetch failed:', error.message)
    return []
  }

  const posts = (data ?? []).map(row => ({
    ...row,
    kind: normalizeKind(row.kind),
    link_url: row.link_url ?? null,
    link_label: row.link_label ?? null
  })) as HomeNewsPost[]

  return sortHomeNewsPosts(posts)
}

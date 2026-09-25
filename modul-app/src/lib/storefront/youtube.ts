/** Termékvideó: csak YouTube link (nem tárolunk videót). */

const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function youtubeIdOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return null
    const host = u.hostname.replace(/^(www\.|m\.)/, '')
    let id: string | null = null
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null
    else if (host === 'youtube.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? null
    }
    return id && ID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

export function youtubeEmbedUrl(id: string, autoplay = false): string {
  return `https://www.youtube-nocookie.com/embed/${id}${autoplay ? '?autoplay=1' : ''}`
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

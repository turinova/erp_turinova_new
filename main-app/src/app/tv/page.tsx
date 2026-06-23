import { resolveTvTheme } from '@/lib/tv-format'

import TvCanvas from './components/shell/TvCanvas'
import TvDashboard from './TvDashboard'

type PageProps = {
  searchParams: Promise<{ theme?: string; preview?: string; orientation?: string }>
}

export default async function TvPage({ searchParams }: PageProps) {
  const params = await searchParams
  const theme = resolveTvTheme(params.theme ?? null)
  const preview = params.preview === 'laptop' ? 'laptop' : 'kiosk'
  const orientation = params.orientation === 'landscape' ? 'landscape' : 'portrait'

  return (
    <div
      data-tv-theme={theme}
      data-preview={preview}
      data-orientation={orientation}
      className="tv-root"
    >
      <TvCanvas preview={preview} orientation={orientation}>
        <TvDashboard />
      </TvCanvas>
    </div>
  )
}

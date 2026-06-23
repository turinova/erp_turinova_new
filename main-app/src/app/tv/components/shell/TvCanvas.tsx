'use client'

import { useEffect, useState } from 'react'

import type { TvOrientation } from '../hooks/useTvPreviewMode'
import type { TvPreviewMode } from '../hooks/useTvPreviewMode'

const LANDSCAPE = { w: 1920, h: 1080 }
const PORTRAIT = { w: 1080, h: 1920 }

type TvCanvasProps = {
  preview: TvPreviewMode
  orientation: TvOrientation
  children: React.ReactNode
}

export default function TvCanvas({ preview, orientation, children }: TvCanvasProps) {
  const [scale, setScale] = useState(1)
  const dims = orientation === 'portrait' ? PORTRAIT : LANDSCAPE

  useEffect(() => {
    if (preview === 'laptop') return

    const update = () => {
      const sx = window.innerWidth / dims.w
      const sy = window.innerHeight / dims.h
      setScale(Math.min(sx, sy, 1))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [preview, dims.w, dims.h])

  if (preview === 'laptop') {
    return <>{children}</>
  }

  const canvasClass = orientation === 'portrait' ? 'tv-canvasPortrait' : 'tv-canvasLandscape'

  return (
    <div className="tv-canvas-host">
      <div
        className={`tv-canvas ${canvasClass}`}
        style={{
          transform: scale < 1 ? `scale(${scale})` : undefined
        }}
      >
        {children}
      </div>
    </div>
  )
}

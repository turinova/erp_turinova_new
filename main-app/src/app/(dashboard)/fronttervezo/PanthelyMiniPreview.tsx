'use client'

import React, { useMemo } from 'react'

import { Box, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import {
  buildStandardPanthelyConfig,
  computeHolePoints,
  defaultEdgeKind,
  oldalLabel,
  summarizePanthely
} from './panthelyGeometry'
import type { PanthelyConfig } from './fronttervezoTypes'

type PanthelyMiniPreviewProps = {
  heightMm: number
  widthMm: number
  panthely: PanthelyConfig
}

/** Compact SVG thumbnail for table rows — same geometry as the modal preview. */
export default function PanthelyMiniPreview({ heightMm, widthMm, panthely }: PanthelyMiniPreviewProps) {
  const theme = useTheme()
  const H = heightMm > 0 ? heightMm : 720
  const W = widthMm > 0 ? widthMm : 400

  const normalized = useMemo(() => {
    if (panthely.mennyiseg >= 2) {
      return buildStandardPanthelyConfig(H, W, panthely.oldal, panthely.mennyiseg)
    }

    return panthely
  }, [H, W, panthely])

  const holes = useMemo(
    () =>
      computeHolePoints(H, W, {
        oldal: normalized.oldal,
        el: 'A',
        tavolsagokAlulMm: normalized.tavolsagokAlulMm
      }),
    [H, W, normalized.oldal, normalized.tavolsagokAlulMm]
  )
  const edgeKind = defaultEdgeKind(H, W, normalized.oldal)
  const summary = summarizePanthely(H, W, normalized)
  const shortLabel = `${normalized.mennyiseg}× ${oldalLabel(normalized.oldal).replace(' oldal', '')}`

  const pad = 8
  const maxW = 40
  const maxH = 56
  const scale = Math.min(maxW / W, maxH / H)
  const pw = W * scale
  const ph = H * scale
  const holeR = Math.max(2.5, Math.min(pw, ph) * 0.06)

  return (
    <Tooltip title={summary}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          verticalAlign: 'middle'
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: maxW + pad * 2,
            height: maxH + pad * 2
          }}
        >
          <svg width={pw + pad * 2} height={ph + pad * 2} aria-label={summary}>
            <rect
              x={pad}
              y={pad}
              width={pw}
              height={ph}
              fill={alpha(theme.palette.primary.main, 0.06)}
              stroke={theme.palette.divider}
              strokeWidth={1}
              rx={2}
            />
            {edgeKind === 'vertical' ? (
              <line
                x1={pad}
                y1={pad}
                x2={pad}
                y2={pad + ph}
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ) : (
              <line
                x1={pad}
                y1={pad + ph}
                x2={pad + pw}
                y2={pad + ph}
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
          {holes.map(h => {
            const isEnd = h.index === 0 || h.index === holes.length - 1
            const minInsetPx = 5
            let cx: number
            let cy: number

            if (edgeKind === 'vertical') {
              const natural = (h.xMm / W) * pw
              cx = pad + Math.max(natural, minInsetPx)
              cy = pad + ph - (h.yMm / H) * ph
            } else {
              cx = pad + (h.xMm / W) * pw
              const natural = (h.yMm / H) * ph
              cy = pad + ph - Math.max(natural, minInsetPx)
            }

            return (
              <circle
                key={h.index}
                cx={cx}
                cy={cy}
                r={isEnd ? holeR + 0.5 : holeR}
                fill={theme.palette.primary.main}
                stroke={theme.palette.background.paper}
                strokeWidth={1}
              />
            )
          })}
          </svg>
        </Box>
        <Typography
          component="span"
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1.2 }}
        >
          {shortLabel}
        </Typography>
      </Box>
    </Tooltip>
  )
}

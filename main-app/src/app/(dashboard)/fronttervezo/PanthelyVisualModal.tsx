'use client'

import React, { useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { toast } from 'react-toastify'

import {
  buildStandardPanthelyConfig,
  computeHolePoints,
  defaultEdgeKind,
  edgeLengthMm,
  oldalLabel,
  PANTHELY_END_OFFSET_MM,
  summarizePanthely,
  validatePanthelyLayout
} from './panthelyGeometry'
import type { PanthelyConfig } from './fronttervezoTypes'

type PanthelyVisualModalProps = {
  open: boolean
  onClose: () => void
  /** Called when user confirms; null means clear panthely */
  onSave: (config: PanthelyConfig | null) => void
  heightMm: number
  widthMm: number
  initial: PanthelyConfig | null
}

/** Simple dimension line with end ticks + centered label. */
function DimLine({
  x1,
  y1,
  x2,
  y2,
  label,
  color,
  labelOffsetX = 0,
  labelOffsetY = 0,
  fontSize = 11
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  color: string
  labelOffsetX?: number
  labelOffsetY?: number
  fontSize?: number
}) {
  const mx = (x1 + x2) / 2 + labelOffsetX
  const my = (y1 + y2) / 2 + labelOffsetY
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * 4
  const ny = (dx / len) * 4

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.25} />
      <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} stroke={color} strokeWidth={1.25} />
      <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} stroke={color} strokeWidth={1.25} />
      <text
        x={mx}
        y={my}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        style={{ fontSize, fontWeight: 800 }}
      >
        {label}
      </text>
    </g>
  )
}

function EdgeTypeIcon({ kind }: { kind: 'hosszu' | 'rovid' }) {
  // Tall bar = hosszú, wide bar = rövid (schematic)
  if (kind === 'hosszu') {
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 8,
          height: 18,
          borderRadius: 0.5,
          bgcolor: 'currentColor',
          mr: 0.75,
          verticalAlign: 'middle',
          opacity: 0.85
        }}
      />
    )
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 18,
        height: 8,
        borderRadius: 0.5,
        bgcolor: 'currentColor',
        mr: 0.75,
        verticalAlign: 'middle',
        opacity: 0.85
      }}
    />
  )
}

export default function PanthelyVisualModal({
  open,
  onClose,
  onSave,
  heightMm,
  widthMm,
  initial
}: PanthelyVisualModalProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const H = heightMm > 0 ? heightMm : 0
  const W = widthMm > 0 ? widthMm : 0
  const hasSize = H > 0 && W > 0
  const previewH = hasSize ? H : 720
  const previewW = hasSize ? W : 400

  const [oldal, setOldal] = useState<'hosszu' | 'rovid'>('hosszu')
  const [count, setCount] = useState(2)

  useEffect(() => {
    if (!open) return

    if (initial && initial.mennyiseg >= 2) {
      setOldal(initial.oldal)
      setCount(initial.mennyiseg)
    } else {
      setOldal('hosszu')
      setCount(2)
    }
  }, [open, initial])

  const draftConfig = useMemo(
    () => buildStandardPanthelyConfig(previewH, previewW, oldal, Math.max(2, count)),
    [previewH, previewW, oldal, count]
  )

  const edgeKind = defaultEdgeKind(previewH, previewW, oldal)
  const edgeLen = edgeLengthMm(previewH, previewW, oldal)
  const isVertical = edgeKind === 'vertical'

  const holes = useMemo(
    () =>
      computeHolePoints(previewH, previewW, {
        oldal,
        el: 'A',
        tavolsagokAlulMm: draftConfig.tavolsagokAlulMm
      }),
    [previewH, previewW, oldal, draftConfig.tavolsagokAlulMm]
  )

  const issues = useMemo(() => {
    if (!hasSize) return []

    return validatePanthelyLayout(H, W, oldal, count)
  }, [hasSize, H, W, oldal, count])

  const alongFromLabel = isVertical ? 'Alulról' : 'Balról'
  const alongHint = isVertical ? 'fentről / lentről' : 'a két vége felől'

  const handleSave = () => {
    if (!hasSize) {
      toast.error('Előbb adja meg a front magasságát és szélességét (mm).')

      return
    }

    const errs = validatePanthelyLayout(H, W, oldal, count)

    if (errs.length > 0) {
      toast.error(errs[0].message)

      return
    }

    onSave(buildStandardPanthelyConfig(H, W, oldal, count))
    onClose()
  }

  const handleDelete = () => {
    onSave(null)
    onClose()
  }

  // SVG layout — extra pad for dimension lines + edge label on the right
  const padL = 64
  const padR = 56
  const padT = 44
  const padB = isVertical ? 44 : 64
  const maxDrawW = 200
  const maxDrawH = 280
  const scale = Math.min(maxDrawW / previewW, maxDrawH / previewH)
  const dw = previewW * scale
  const dh = previewH * scale
  const holeR = Math.max(5, Math.min(dw, dh) * 0.032)
  const endHoleR = holeR + 2
  const dimColor = theme.palette.text.secondary
  const accent = theme.palette.primary.main

  const originX = padL
  const originY = padT
  const toSvgX = (xMm: number) => originX + (xMm / previewW) * dw
  const toSvgY = (yMm: number) => originY + dh - (yMm / previewH) * dh

  const svgW = padL + dw + padR
  const svgH = padT + dh + padB

  // First / last for 100 mm end dimensions
  const firstHole = holes[0]
  const lastHole = holes[holes.length - 1]

  // Inter-hole gaps (show when 3–6 holes so labels stay readable)
  const showGapLabels = holes.length >= 3 && holes.length <= 6

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.35rem', pb: 0.5 }}>
        Pánthelyfúrás
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2, fontSize: '1rem' }}>
          Hosszú vagy rövid oldal — a pánthelyek a bútorlap széle mögött, bent helyezkednek el.
        </Typography>

        {!hasSize ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Adja meg a front <strong>magasságát</strong> és <strong>szélességét</strong> a formon — a vázlat
            jelenleg sematikus ({previewH}×{previewW} mm).
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
            alignItems: 'stretch'
          }}
        >
          {/* Engineering preview + distance table */}
          <Box
            sx={{
              flex: '0 0 auto',
              alignSelf: { xs: 'center', md: 'flex-start' },
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              maxWidth: { xs: '100%', md: 360 }
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.grey[900], 0.02)
              }}
            >
              <svg
                width={svgW}
                height={svgH}
                role="img"
                aria-label={`Front vázlat ${previewH}×${previewW} mm, ${holes.length} pánthely, ${oldalLabel(oldal)}`}
              >
                {/* Panel */}
                <rect
                  x={originX}
                  y={originY}
                  width={dw}
                  height={dh}
                  fill={alpha(accent, isDark ? 0.12 : 0.06)}
                  stroke={theme.palette.text.primary}
                  strokeWidth={1.5}
                  rx={3}
                />

                {/* Hinge edge highlight */}
                {isVertical ? (
                  <line
                    x1={originX}
                    y1={originY}
                    x2={originX}
                    y2={originY + dh}
                    stroke={accent}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                ) : (
                  <line
                    x1={originX}
                    y1={toSvgY(0)}
                    x2={originX + dw}
                    y2={toSvgY(0)}
                    stroke={accent}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                )}

                {/* Edge type label along hinge edge (opposite side of 100 mm dims) */}
                {isVertical ? (
                  <text
                    x={originX + dw + 40}
                    y={originY + dh / 2}
                    textAnchor="middle"
                    fill={accent}
                    transform={`rotate(90 ${originX + dw + 40} ${originY + dh / 2})`}
                    style={{ fontSize: 11, fontWeight: 800 }}
                  >
                    {oldalLabel(oldal)} · {edgeLen} mm
                  </text>
                ) : (
                  <text
                    x={originX + dw / 2}
                    y={originY - 14}
                    textAnchor="middle"
                    fill={accent}
                    style={{ fontSize: 11, fontWeight: 800 }}
                  >
                    {oldalLabel(oldal)} · {edgeLen} mm
                  </text>
                )}

                {/* Orientation */}
                {!isVertical ? null : (
                  <text
                    x={originX + dw / 2}
                    y={originY - 12}
                    textAnchor="middle"
                    fill={theme.palette.text.disabled}
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Felül
                  </text>
                )}
                {isVertical ? (
                  <text
                    x={originX + dw / 2}
                    y={originY + dh + 18}
                    textAnchor="middle"
                    fill={theme.palette.text.disabled}
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Alul
                  </text>
                ) : (
                  <text
                    x={originX + dw / 2}
                    y={toSvgY(0) + 44}
                    textAnchor="middle"
                    fill={theme.palette.text.disabled}
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    Alul (vázlat él)
                  </text>
                )}
                <text
                  x={originX - 8}
                  y={originY + dh / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={theme.palette.text.disabled}
                  transform={`rotate(-90 ${originX - 8} ${originY + dh / 2})`}
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {isVertical ? 'Bal (vázlat él)' : 'Bal'}
                </text>

                {/* Panel outer size */}
                <text
                  x={originX + dw / 2}
                  y={svgH - 8}
                  textAnchor="middle"
                  fill={theme.palette.text.secondary}
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {previewW} × {previewH} mm
                </text>

                {/* 100 mm end dimensions (outside panel, along hinge edge) */}
                {firstHole && lastHole && isVertical ? (
                  <>
                    <DimLine
                      x1={originX - 28}
                      y1={toSvgY(0)}
                      x2={originX - 28}
                      y2={toSvgY(firstHole.distMm)}
                      label={`${PANTHELY_END_OFFSET_MM}`}
                      color={dimColor}
                      labelOffsetX={-14}
                    />
                    <DimLine
                      x1={originX - 28}
                      y1={toSvgY(lastHole.distMm)}
                      x2={originX - 28}
                      y2={toSvgY(edgeLen)}
                      label={`${PANTHELY_END_OFFSET_MM}`}
                      color={dimColor}
                      labelOffsetX={-14}
                    />
                  </>
                ) : null}
                {firstHole && lastHole && !isVertical ? (
                  <>
                    <DimLine
                      x1={toSvgX(0)}
                      y1={toSvgY(0) + 28}
                      x2={toSvgX(firstHole.distMm)}
                      y2={toSvgY(0) + 28}
                      label={`${PANTHELY_END_OFFSET_MM}`}
                      color={dimColor}
                      labelOffsetY={12}
                    />
                    <DimLine
                      x1={toSvgX(lastHole.distMm)}
                      y1={toSvgY(0) + 28}
                      x2={toSvgX(edgeLen)}
                      y2={toSvgY(0) + 28}
                      label={`${PANTHELY_END_OFFSET_MM}`}
                      color={dimColor}
                      labelOffsetY={12}
                    />
                  </>
                ) : null}

                {/* Inter-hole gap labels */}
                {showGapLabels
                  ? holes.slice(0, -1).map((h, i) => {
                      const next = holes[i + 1]!
                      const gap = next.distMm - h.distMm
                      if (gap <= 0) return null

                      if (isVertical) {
                        const midY = (toSvgY(h.distMm) + toSvgY(next.distMm)) / 2

                        return (
                          <text
                            key={`gap-${i}`}
                            x={toSvgX(h.xMm) + 36}
                            y={midY}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fill={alpha(theme.palette.text.primary, 0.55)}
                            style={{ fontSize: 10, fontWeight: 600 }}
                          >
                            ↔ {gap}
                          </text>
                        )
                      }

                      const midX = (toSvgX(h.distMm) + toSvgX(next.distMm)) / 2

                      return (
                        <text
                          key={`gap-${i}`}
                          x={midX}
                          y={toSvgY(h.yMm) - 16}
                          textAnchor="middle"
                          fill={alpha(theme.palette.text.primary, 0.55)}
                          style={{ fontSize: 10, fontWeight: 600 }}
                        >
                          ↔ {gap}
                        </text>
                      )
                    })
                  : null}

                {/* Holes — visually clearly inside the edge (not on the rim) */}
                {holes.map(h => {
                  const isEnd = h.index === 0 || h.index === holes.length - 1
                  const r = isEnd ? endHoleR : holeR
                  // Min ~12px inset so the holes read as "inside the board", not on the edge stroke
                  const minInsetPx = 12
                  let cx: number
                  let cy: number

                  if (isVertical) {
                    const natural = toSvgX(h.xMm) - originX
                    cx = originX + Math.max(natural, minInsetPx)
                    cy = toSvgY(h.yMm)
                  } else {
                    cx = toSvgX(h.xMm)
                    const natural = toSvgY(0) - toSvgY(h.yMm)
                    cy = toSvgY(0) - Math.max(natural, minInsetPx)
                  }

                  return (
                    <g key={h.index}>
                      {isVertical ? (
                        <line
                          x1={originX}
                          y1={cy}
                          x2={cx}
                          y2={cy}
                          stroke={alpha(accent, 0.35)}
                          strokeWidth={1}
                          strokeDasharray="4 3"
                        />
                      ) : (
                        <line
                          x1={cx}
                          y1={toSvgY(0)}
                          x2={cx}
                          y2={cy}
                          stroke={alpha(accent, 0.35)}
                          strokeWidth={1}
                          strokeDasharray="4 3"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={isEnd ? accent : alpha(accent, 0.75)}
                        stroke={theme.palette.background.paper}
                        strokeWidth={isEnd ? 2.5 : 2}
                      />
                      <text
                        x={isVertical ? cx + 22 : cx}
                        y={isVertical ? cy + 4 : cy - 12}
                        textAnchor="middle"
                        fill={theme.palette.text.primary}
                        style={{ fontSize: 11, fontWeight: 800 }}
                      >
                        {h.index + 1}
                      </text>
                    </g>
                  )
                })}
              </svg>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', mt: 0.75, lineHeight: 1.4, px: 0.5 }}
              >
                A {isVertical ? 'bal' : 'alsó'} él csak vázlat — a <strong>hosszú/rövid oldal</strong> számít, nem
                bal/jobb. Végeken {PANTHELY_END_OFFSET_MM} mm.
              </Typography>
            </Box>

            {/* Distance table — only from one end (the other is redundant) */}
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden'
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', px: 1.25, pt: 1, pb: 0.5 }}>
                Kiosztás · {alongFromLabel.toLowerCase()}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 0.5 }}>#</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 0.5 }}>
                      mm
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {holes.map(h => {
                    const isEnd = h.index === 0 || h.index === holes.length - 1

                    return (
                      <TableRow key={h.index} selected={isEnd}>
                        <TableCell sx={{ py: 0.4, fontWeight: isEnd ? 800 : 500 }}>{h.index + 1}</TableCell>
                        <TableCell align="right" sx={{ py: 0.4, fontWeight: isEnd ? 800 : 500 }}>
                          {h.distMm}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          </Box>

          {/* Controls */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>1. Hány pánthely?</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  variant={count === 2 ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setCount(2)}
                  sx={{ fontWeight: 700, textTransform: 'none', minWidth: 88 }}
                >
                  2 pánt
                </Button>
                <Button
                  variant={count === 3 ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setCount(3)}
                  sx={{ fontWeight: 700, textTransform: 'none', minWidth: 88 }}
                >
                  3 pánt
                </Button>
                <Button
                  variant={count === 4 ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setCount(4)}
                  sx={{ fontWeight: 700, textTransform: 'none', minWidth: 88 }}
                >
                  4 pánt
                </Button>
                <TextField
                  size="small"
                  label="Egyéni db"
                  value={String(count)}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '')

                    if (digits === '') {
                      setCount(2)

                      return
                    }

                    const n = parseInt(digits, 10)

                    if (Number.isFinite(n)) setCount(Math.min(12, Math.max(2, n)))
                  }}
                  sx={{ width: 110 }}
                  inputProps={{ inputMode: 'numeric', min: 2, max: 12 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {alongHint} mindig {PANTHELY_END_OFFSET_MM} mm (10 cm)
                {count > 2 ? '; a közbülsők egyenletesen.' : '.'}
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1 }}>2. Melyik oldalon?</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<EdgeTypeIcon kind="hosszu" />}
                  label="Hosszú oldal"
                  color={oldal === 'hosszu' ? 'primary' : 'default'}
                  variant={oldal === 'hosszu' ? 'filled' : 'outlined'}
                  onClick={() => setOldal('hosszu')}
                  sx={{ fontWeight: 700, fontSize: '0.95rem', height: 40, pl: 0.5 }}
                />
                <Chip
                  icon={<EdgeTypeIcon kind="rovid" />}
                  label="Rövid oldal"
                  color={oldal === 'rovid' ? 'primary' : 'default'}
                  variant={oldal === 'rovid' ? 'filled' : 'outlined'}
                  onClick={() => setOldal('rovid')}
                  sx={{ fontWeight: 700, fontSize: '0.95rem', height: 40, pl: 0.5 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Nem kell bal/jobb választás — csak hosszú vagy rövid oldal (élhossz: {edgeLen} mm).
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: isDark ? alpha(theme.palette.common.white, 0.04) : alpha(theme.palette.grey[900], 0.03)
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Fix kiosztás</Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                  <li>A pánthelyek a bútorlap széle mögött, bent vannak</li>
                  <li>
                    Szélső pántok: mindig <strong>{PANTHELY_END_OFFSET_MM} mm</strong> a végektől (10 cm)
                  </li>
                  <li>3+ pánt: a közbülsők egyenletesen a két szélső között</li>
                </Box>
              </Typography>
            </Box>

            {issues.length > 0 ? (
              <Alert severity="error">{issues[0].message}</Alert>
            ) : (
              <Alert severity="success" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
                {summarizePanthely(previewH, previewW, draftConfig)}
              </Alert>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600 }}>
          Mégse
        </Button>
        <Button onClick={handleDelete} color="error" sx={{ fontWeight: 600 }}>
          Törlés
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" sx={{ fontWeight: 800, px: 2.5 }}>
          Mentés – így kérem
        </Button>
      </DialogActions>
    </Dialog>
  )
}

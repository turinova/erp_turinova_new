'use client'

import React, { useMemo } from 'react'
import { Box, Card, CardContent, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

import type { FootcounterHomeSlim } from '@/types/footcounter'

const STALE_MINUTES = 20
const BUDAPEST_TZ = 'Europe/Budapest'

function formatShortTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('hu-HU', {
    timeZone: BUDAPEST_TZ,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 60_000
}

type DayMood = 'no_baseline' | 'typical' | 'busy' | 'quiet'

interface MoodResult {
  mood: DayMood
  heroLabel: string
  heroColor: (theme: Theme) => string
  subtitle: string | null
}

function dayMood(stats: FootcounterHomeSlim): MoodResult {
  const sw = stats.same_weekday_avg
  if (!sw || sw.sample_days < 1 || sw.avg_in <= 0) {
    if (stats.today_in > 0) {
      return {
        mood: 'no_baseline',
        heroLabel: `${stats.today_in} belépő ma`,
        heroColor: t => t.palette.success.main,
        subtitle: null
      }
    }
    return {
      mood: 'no_baseline',
      heroLabel: 'Nincs mai adat',
      heroColor: t => t.palette.text.secondary,
      subtitle: null
    }
  }
  const pct = Math.round((stats.today_in / sw.avg_in - 1) * 100)
  if (Math.abs(pct) <= 10) {
    return {
      mood: 'typical',
      heroLabel: 'Szokásos nap',
      heroColor: t => t.palette.info.main,
      subtitle: 'az átlag körül'
    }
  }
  if (pct > 10) {
    return {
      mood: 'busy',
      heroLabel: 'Erős forgalom',
      heroColor: t => t.palette.success.main,
      subtitle: `+${pct}% az átlaghoz képest`
    }
  }
  return {
    mood: 'quiet',
    heroLabel: 'Enyhe forgalom',
    heroColor: t => t.palette.warning.main,
    subtitle: `${pct}% az átlaghoz képest`
  }
}

function stripeColor(theme: Theme, mood: DayMood): string {
  const isDark = theme.palette.mode === 'dark'
  switch (mood) {
    case 'busy':
      return isDark ? alpha(theme.palette.success.main, 0.6) : alpha(theme.palette.success.main, 0.5)
    case 'quiet':
      return isDark ? alpha(theme.palette.warning.main, 0.55) : alpha(theme.palette.warning.main, 0.45)
    case 'typical':
      return isDark ? alpha(theme.palette.info.main, 0.55) : alpha(theme.palette.info.main, 0.45)
    default:
      return isDark ? alpha(theme.palette.info.main, 0.35) : alpha(theme.palette.info.main, 0.25)
  }
}

/** Map value 0..max → color from transparent to solid info.main */
function heatCellColor(theme: Theme, value: number, max: number): string {
  if (max <= 0 || value <= 0) {
    return theme.palette.mode === 'dark'
      ? alpha(theme.palette.info.main, 0.06)
      : alpha(theme.palette.info.main, 0.05)
  }
  const t = Math.min(1, value / max)
  const minOpacity = theme.palette.mode === 'dark' ? 0.12 : 0.1
  const maxOpacity = theme.palette.mode === 'dark' ? 0.85 : 0.75
  const opacity = minOpacity + t * (maxOpacity - minOpacity)
  return alpha(theme.palette.info.main, opacity)
}

const HOUR_START = 7
const HOUR_END = 18

/** Heatmap row with belépő on left, kilépő on right, heatmap cells in the middle. */
function HourlyHeatmapRow({ values, todayIn, todayOut }: { values: number[]; todayIn: number; todayOut: number }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const slice = values.slice(HOUR_START, HOUR_END + 1)
  const hasData = slice.some(v => v > 0)
  const currentHour = new Date().getHours()
  const max = Math.max(1, ...slice)

  const peakIdx = slice.indexOf(Math.max(...slice))
  const peakHour = HOUR_START + peakIdx
  const activeHours = slice.filter(v => v > 0).length

  return (
    <Box>
      {/* Stats header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          Napi eloszlás
        </Typography>
        {hasData && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Csúcs:{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'info.main' }}>
                {peakHour}:00
              </Box>
              {' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                ({slice[peakIdx]})
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Aktív:{' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                {activeHours}h
              </Box>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Main row: belépő | heatmap | kilépő */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Belépő — left */}
        <Box sx={{ textAlign: 'center', flexShrink: 0, minWidth: 52 }}>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              color: 'success.main',
            }}
          >
            {todayIn}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500, color: 'text.secondary' }}>
            belépő
          </Typography>
        </Box>

        {/* Heatmap cells — center */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              gap: '2px',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {slice.map((v, i) => {
              const hour = HOUR_START + i
              const isCurrent = hour === currentHour
              return (
                <Tooltip
                  key={hour}
                  title={`${hour}:00 — ${v} belépő`}
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 22,
                      borderRadius: 0.5,
                      bgcolor: heatCellColor(theme, v, max),
                      transition: 'background-color 0.15s',
                      cursor: 'default',
                      ...(isCurrent && {
                        boxShadow: `inset 0 0 0 1.5px ${isDark ? theme.palette.info.light : theme.palette.info.dark}`,
                      }),
                    }}
                  />
                </Tooltip>
              )
            })}
          </Box>

          {/* Hour labels */}
          <Box sx={{ display: 'flex', gap: '2px', mt: 0.25 }}>
            {slice.map((_, i) => {
              const hour = HOUR_START + i
              const show = hour === HOUR_START || hour === 12 || hour === HOUR_END
              return (
                <Box key={hour} sx={{ flex: 1, textAlign: 'center' }}>
                  {show && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.6rem',
                        color: 'text.disabled',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {hour}
                    </Typography>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Kilépő — right */}
        <Box sx={{ textAlign: 'center', flexShrink: 0, minWidth: 52 }}>
          <Typography
            sx={{
              fontSize: '1.25rem',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              color: 'warning.main',
            }}
          >
            {todayOut}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500, color: 'text.secondary' }}>
            kilépő
          </Typography>
        </Box>
      </Box>

      {/* Legend — gradient bar */}
      {hasData && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, px: '52px' }}>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
            0
          </Typography>
          <Box
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${alpha(theme.palette.info.main, isDark ? 0.08 : 0.06)} 0%, ${alpha(theme.palette.info.main, isDark ? 0.85 : 0.75)} 100%)`,
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
            {max}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

type FootcounterHomeCardProps = {
  data: FootcounterHomeSlim
}

export default function FootcounterHomeCard({ data }: FootcounterHomeCardProps) {
  const theme = useTheme()
  const { mood } = useMemo(() => dayMood(data), [data])
  const seenMin = minutesSince(data.device_last_seen)
  const online = seenMin != null && seenMin <= STALE_MINUTES

  return (
    <Card
      variant="outlined"
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: t => (t.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)'),
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: stripeColor(theme, mood),
          borderRadius: '3px 0 0 3px'
        }
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, pl: 2.125, '&:last-child': { pb: 1.5 } }}>
        {/* Header — title + online status */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <DirectionsWalkOutlinedIcon sx={{ fontSize: 20, color: 'info.main', flexShrink: 0 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.25, color: 'text.primary' }}>
              Mai forgalom
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
            <FiberManualRecordIcon sx={{ fontSize: 10, color: online ? 'success.main' : 'text.disabled' }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: online ? 600 : 400,
                color: online ? 'success.main' : 'text.secondary'
              }}
            >
              {online ? 'Számláló aktív' : 'Számláló nem jelez'}
            </Typography>
          </Box>
        </Box>

        {/* Heatmap row with belépő left + kilépő right */}
        <HourlyHeatmapRow values={data.hourly_in} todayIn={data.today_in} todayOut={data.today_out} />

        {/* Footer */}
        <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
            Utolsó észlelés:{' '}
            <Box component="span" sx={{ fontWeight: 600 }}>
              {formatShortTime(data.last_event_at)}
            </Box>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

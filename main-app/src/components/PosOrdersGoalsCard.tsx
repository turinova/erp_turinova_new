'use client'

import React from 'react'
import NextLink from 'next/link'
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Link as MuiLink,
  Tooltip,
  Typography
} from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import TodayIcon from '@mui/icons-material/Today'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { PosOrdersGoalStats } from '@/lib/dashboard-server'

export const POS_GOAL_DAY = 15
export const POS_GOAL_MONTH = 300

const BUDAPEST_TZ = 'Europe/Budapest'

/** Y / M (1–12) / D in Europe/Budapest for "today". */
function getBudapestYmd(): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUDAPEST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function daysInMonthUtc(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * Days from today through month end in Budapest calendar (inclusive).
 * E.g. Mar 28 → 4 (28–31).
 */
function budapestDaysLeftInMonthIncludingToday(): number {
  const { y, m, d } = getBudapestYmd()
  const dim = daysInMonthUtc(y, m)
  return Math.max(1, dim - d + 1)
}

/** Progress fill: one accent family; green only when done; amber if behind pace. */
type BarState = 'done' | 'on_track' | 'behind'

function getBarState(pct: number, met: boolean): BarState {
  if (met) return 'done'
  if (pct < 50) return 'behind'
  return 'on_track'
}

function barStyles(theme: Theme, state: BarState) {
  const isDark = theme.palette.mode === 'dark'
  const neutralTrack =
    theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : alpha('#37352F', 0.08)

  if (state === 'done') {
    const { main, light } = theme.palette.success
    return {
      track: alpha(main, isDark ? 0.18 : 0.12),
      bar: isDark
        ? `linear-gradient(90deg, ${alpha(light, 0.5)} 0%, ${alpha(main, 0.7)} 100%)`
        : `linear-gradient(90deg, #A8D4B8 0%, ${main} 100%)`
    }
  }

  if (state === 'behind') {
    const { main, light } = theme.palette.warning
    return {
      track: neutralTrack,
      bar: isDark
        ? `linear-gradient(90deg, ${alpha(light, 0.45)} 0%, ${alpha(main, 0.55)} 100%)`
        : `linear-gradient(90deg, #F5D0A8 0%, #E8954A 100%)`
    }
  }

  const { main, light } = theme.palette.info
  return {
    track: neutralTrack,
    bar: isDark
      ? `linear-gradient(90deg, ${alpha(light, 0.45)} 0%, ${alpha(main, 0.58)} 100%)`
      : `linear-gradient(90deg, #9BCADF 0%, #2E8BB5 100%)`
  }
}

function cardAccentStripe(theme: Theme, bothMet: boolean): string {
  if (bothMet) {
    return theme.palette.mode === 'dark'
      ? alpha(theme.palette.success.main, 0.65)
      : alpha(theme.palette.success.main, 0.55)
  }
  return theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.14) : alpha('#37352F', 0.12)
}

/** Past / today chip state vs daily goal (15). Future days use `future`. */
type DayChipKind = 'future' | 'today_pending' | 'met' | 'almost' | 'not_met'

function getDayChipKind(day: number, count: number, todayDay: number): DayChipKind {
  if (day > todayDay) return 'future'
  if (day === todayDay && count === 0) return 'today_pending'
  if (count >= POS_GOAL_DAY) return 'met'
  if (count >= 10) return 'almost'
  return 'not_met'
}

function dayChipSx(theme: Theme, kind: DayChipKind, isToday: boolean): Record<string, unknown> {
  const isDark = theme.palette.mode === 'dark'
  const ring =
    isToday && kind !== 'future'
      ? {
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, isDark ? 0.85 : 0.35)}`
        }
      : {}

  const base = {
    minWidth: 30,
    height: 26,
    fontSize: '0.7rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as const,
    borderRadius: 1,
    ...ring
  }

  switch (kind) {
    case 'future':
      return {
        ...base,
        bgcolor: isDark ? alpha(theme.palette.common.white, 0.05) : alpha('#37352F', 0.04),
        color: 'text.disabled',
        border: '1px solid',
        borderColor: isDark ? alpha(theme.palette.common.white, 0.08) : alpha('#37352F', 0.08),
        opacity: 0.75
      }
    case 'today_pending':
      return {
        ...base,
        bgcolor: isDark ? alpha(theme.palette.info.main, 0.12) : alpha(theme.palette.info.main, 0.08),
        color: 'info.dark',
        border: '1px dashed',
        borderColor: alpha(theme.palette.info.main, 0.35)
      }
    case 'met':
      return {
        ...base,
        bgcolor: isDark ? alpha(theme.palette.success.main, 0.22) : alpha(theme.palette.success.main, 0.14),
        color: isDark ? theme.palette.success.light : theme.palette.success.dark,
        border: '1px solid',
        borderColor: alpha(theme.palette.success.main, 0.4)
      }
    case 'almost':
      return {
        ...base,
        bgcolor: isDark ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.warning.main, 0.14),
        color: isDark ? theme.palette.warning.light : theme.palette.warning.dark,
        border: '1px solid',
        borderColor: alpha(theme.palette.warning.main, 0.35)
      }
    case 'not_met':
      return {
        ...base,
        bgcolor: isDark ? alpha(theme.palette.error.main, 0.18) : alpha(theme.palette.error.main, 0.1),
        color: isDark ? theme.palette.error.light : theme.palette.error.dark,
        border: '1px solid',
        borderColor: alpha(theme.palette.error.main, 0.3)
      }
    default:
      return base
  }
}

function MonthDayChipsRow({
  monthDaily,
  budapestTodayDay
}: {
  monthDaily: { day: number; count: number }[]
  budapestTodayDay: number
}) {
  const theme = useTheme()
  const fallbackToday = getBudapestYmd().d
  const todayDay = budapestTodayDay > 0 ? budapestTodayDay : fallbackToday

  if (!monthDaily.length) return null

  return (
    <Box
      sx={{
        mt: 1.5,
        pt: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, lineHeight: 1.4 }}>
        A hónap napjai — szín:{' '}
        <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
          cél ok
        </Box>
        {' · '}
        <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
          közel
        </Box>
        {' · '}
        <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
          elmaradt
        </Box>
        {' · halvány: még nem esedékes'}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 0.5,
          overflowX: 'auto',
          pb: 0.5,
          mx: -0.25,
          px: 0.25,
          WebkitOverflowScrolling: 'touch',
          scrollbarGutter: 'stable'
        }}
      >
        {monthDaily.map(({ day, count }) => {
          const kind = getDayChipKind(day, count, todayDay)
          const isToday = day === todayDay
          const tooltip =
            kind === 'future'
              ? `${day}. nap — még nem telt el (cél: ${POS_GOAL_DAY} / nap)`
              : `${day}. nap: ${count} befejezett rendelés (cél: ${POS_GOAL_DAY} / nap)`

          return (
            <Tooltip key={day} title={tooltip} arrow placement="top">
              <Chip
                label={String(day)}
                size="small"
                sx={dayChipSx(theme, kind, isToday) as object}
              />
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}

type PosOrdersGoalsCardProps = {
  posOrdersGoalStats: PosOrdersGoalStats
}

function GoalRow({
  label,
  current,
  goal,
  helper,
  icon
}: {
  label: string
  current: number
  goal: number
  helper: string | null
  icon: React.ReactElement
}) {
  const theme = useTheme()
  const pct = Math.min(100, (current / goal) * 100)
  const met = current >= goal
  const barState = getBarState(pct, met)
  const { track, bar } = barStyles(theme, barState)

  const pillBorder = met
    ? alpha(theme.palette.success.main, 0.35)
    : theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.12)
      : alpha('#37352F', 0.12)
  const pillBg = met
    ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.07)
    : theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.04)
      : alpha('#37352F', 0.04)

  return (
    <Box
      sx={{
        mb: 1.15,
        pb: 1.15,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { mb: 0, pb: 0, borderBottom: 'none' }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 0.45 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            icon={icon}
            label={label}
            size="small"
            sx={{
              height: 24,
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.02em',
              bgcolor: theme => (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.06) : '#F1F1EF'),
              color: 'text.primary',
              border: '1px solid',
              borderColor: theme => (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : '#E3E2DD'),
              '& .MuiChip-icon': { color: 'text.secondary' }
            }}
          />
          {met && (
            <Chip
              icon={<CheckCircleOutlineIcon sx={{ fontSize: '0.9rem !important' }} />}
              label="Kész"
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                color: 'success.main',
                borderColor: theme => alpha(theme.palette.success.main, 0.4),
                bgcolor: 'transparent',
                '& .MuiChip-icon': { color: 'inherit' }
              }}
            />
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 0.5,
            flexShrink: 0,
            px: 0.85,
            py: 0.4,
            borderRadius: 1.25,
            border: '1px solid',
            borderColor: pillBorder,
            bgcolor: pillBg
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              color: met ? 'success.main' : 'text.primary'
            }}
          >
            {current}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.secondary'
            }}
          >
            / {goal}
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 999,
          bgcolor: track,
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            background: bar
          }
        }}
      />
      {helper && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.45,
            lineHeight: 1.4,
            fontWeight: met ? 600 : 400,
            color: met ? 'success.main' : 'text.secondary'
          }}
        >
          {helper}
        </Typography>
      )}
    </Box>
  )
}

export default function PosOrdersGoalsCard({ posOrdersGoalStats }: PosOrdersGoalsCardProps) {
  const theme = useTheme()
  const { todayCount, monthCount, monthDaily, budapestTodayDay } = posOrdersGoalStats
  const bothMet = todayCount >= POS_GOAL_DAY && monthCount >= POS_GOAL_MONTH

  const dayRemaining = Math.max(0, POS_GOAL_DAY - todayCount)
  const monthRemaining = Math.max(0, POS_GOAL_MONTH - monthCount)
  const daysLeftMonth = budapestDaysLeftInMonthIncludingToday()
  const paceNeeded =
    monthCount >= POS_GOAL_MONTH || monthRemaining <= 0 ? null : Math.ceil(monthRemaining / daysLeftMonth)

  const dayHelper =
    todayCount >= POS_GOAL_DAY
      ? 'Mai cél teljesítve — így tovább!'
      : dayRemaining > 0
        ? `Még ${dayRemaining} a mai célhoz.`
        : null

  const monthHelper =
    monthCount >= POS_GOAL_MONTH
      ? 'Havi cél teljesítve — szuper!'
      : monthRemaining > 0
        ? paceNeeded != null
          ? `Még ${monthRemaining} a havi célhoz. Átlagosan ~${paceNeeded} / nap kell a hónap végéig (${BUDAPEST_TZ}).`
          : `Még ${monthRemaining} a havi célhoz.`
        : null

  const stripe = cardAccentStripe(theme, bothMet)

  return (
    <Card
      variant="outlined"
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: theme =>
          theme.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: stripe,
          borderRadius: '3px 0 0 3px'
        }
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, pl: 2.125, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3, color: 'text.primary' }}>
                POS rendelések
              </Typography>
              <Chip
                label="Közös cél"
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: theme => (theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : '#FFFFFF'),
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'text.secondary'
                }}
              />
              {bothMet && (
                <Chip
                  icon={<CheckCircleOutlineIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label="Mindkét cél kész"
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'success.main',
                    borderColor: theme => alpha(theme.palette.success.main, 0.4),
                    bgcolor: 'transparent',
                    '& .MuiChip-icon': { color: 'inherit' }
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
              Befejezett, nem törölt · cél: {POS_GOAL_DAY} / nap · {POS_GOAL_MONTH} / hónap
            </Typography>
          </Box>
          <MuiLink
            component={NextLink}
            href="/pos-orders"
            variant="caption"
            fontWeight={600}
            underline="hover"
            sx={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              color: 'text.primary',
              opacity: 0.85,
              '&:hover': { opacity: 1 }
            }}
          >
            Lista →
          </MuiLink>
        </Box>

        <GoalRow
          label="MA"
          current={todayCount}
          goal={POS_GOAL_DAY}
          helper={dayHelper}
          icon={<TodayIcon sx={{ fontSize: '0.9rem' }} />}
        />
        <GoalRow
          label="EZ A HÓNAP"
          current={monthCount}
          goal={POS_GOAL_MONTH}
          helper={monthHelper}
          icon={<CalendarMonthIcon sx={{ fontSize: '0.9rem' }} />}
        />

        <MonthDayChipsRow monthDaily={monthDaily} budapestTodayDay={budapestTodayDay} />
      </CardContent>
    </Card>
  )
}

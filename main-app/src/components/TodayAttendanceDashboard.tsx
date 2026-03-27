'use client'

import React, { useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

/**
 * Requested color mapping:
 * - in (bent): success
 * - left (tavozott): warning
 * - holiday/sick: danger
 */
const NOTION_ATTENDANCE = {
  in: {
    border: '#7CB89A',
    bg: '#E8F5EE',
    hoverBg: '#DCF2E6',
    chipBg: '#E8F5EE',
    chipBorder: '#B8DEC9',
    chipText: '#2F6F4F'
  },
  left: {
    border: '#E8B86D',
    bg: '#FFF8E8',
    hoverBg: '#FFF0D4',
    chipBg: '#FFF8E8',
    chipBorder: '#F0D08A',
    chipText: '#8B5A00'
  },
  holiday: {
    border: '#E57373',
    bg: '#FDECEC',
    hoverBg: '#FAD4D4',
    chipBg: '#FDECEC',
    chipBorder: '#EF9A9A',
    chipText: '#B71C1C'
  },
  none: {
    border: '#DDD8CF',
    bg: '#FAFAF8',
    hoverBg: '#F3F1EC',
    chipBg: '#F5F3EF',
    chipBorder: '#D4CFC4',
    chipText: '#5C5A57'
  },
  odd: {
    border: '#B39DDB',
    bg: '#F3EFFF',
    hoverBg: '#E8E0FA',
    chipBg: '#F3EFFF',
    chipBorder: '#CEBFE8',
    chipText: '#5E35B1'
  }
} as const

type NotionKey = keyof typeof NOTION_ATTENDANCE

export type TodayAttendanceEmployee = {
  id: string
  name: string
  employee_code: string
  shift_start_time: string | null
  holiday_type: 'Szabadság' | 'Betegszabadság' | null
  holiday_name: string | null
  arrival: string | null
  departure: string | null
}

function attendanceCardKey(emp: TodayAttendanceEmployee): NotionKey {
  const { arrival, departure, holiday_type } = emp
  if (holiday_type) return 'holiday'
  if (!arrival && departure) return 'odd'
  if (!arrival && !departure) return 'none'
  if (arrival && departure) return 'left'
  return 'in'
}

interface TodayAttendanceDashboardProps {
  dateLabel: string
  employees: TodayAttendanceEmployee[]
}

export default function TodayAttendanceDashboard({ dateLabel, employees }: TodayAttendanceDashboardProps) {
  const theme = useTheme()

  const counts = useMemo(() => {
    let bent = 0
    let tavozott = 0
    let holiday = 0
    let nincs = 0
    let odd = 0
    for (const e of employees) {
      const k = attendanceCardKey(e)
      if (k === 'in') bent++
      if (k === 'left') tavozott++
      if (k === 'holiday') holiday++
      if (k === 'odd') odd++
      if (k === 'none') nincs++
    }
    return { bent, tavozott, holiday, nincs, odd }
  }, [employees])

  const orderedEmployees = useMemo(() => {
    const rank: Record<NotionKey, number> = {
      in: 0,
      left: 1,
      holiday: 2,
      none: 3,
      odd: 4
    }
    return [...employees].sort((a, b) => {
      const ra = rank[attendanceCardKey(a)]
      const rb = rank[attendanceCardKey(b)]
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, 'hu')
    })
  }, [employees])

  if (employees.length === 0) {
    return (
      <Box>
        <Typography variant="h6" component="h2" gutterBottom>
          Mai jelenlét
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Nincs aktív dolgozó a listában.
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        bgcolor: '#FBFBFA',
        borderRadius: '16px',
        p: { xs: 2, sm: 2.5 },
        border: '1px solid #E8E7E4',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ color: '#37352F', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Mai jelenlét
        </Typography>
        <Typography variant="body2" sx={{ color: '#787774', fontWeight: 500 }}>
          {dateLabel}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Chip
          size="small"
          label={`Bent: ${counts.bent}`}
          variant="outlined"
          sx={{
            bgcolor: NOTION_ATTENDANCE.in.chipBg,
            borderColor: NOTION_ATTENDANCE.in.chipBorder,
            color: NOTION_ATTENDANCE.in.chipText,
            fontWeight: 600
          }}
        />
        <Chip
          size="small"
          label={`Távozott: ${counts.tavozott}`}
          variant="outlined"
          sx={{
            bgcolor: NOTION_ATTENDANCE.left.chipBg,
            borderColor: NOTION_ATTENDANCE.left.chipBorder,
            color: NOTION_ATTENDANCE.left.chipText,
            fontWeight: 600
          }}
        />
        {counts.holiday > 0 ? (
          <Chip
            size="small"
            label={`Szabadság / Beteg: ${counts.holiday}`}
            variant="outlined"
            sx={{
              bgcolor: NOTION_ATTENDANCE.holiday.chipBg,
              borderColor: NOTION_ATTENDANCE.holiday.chipBorder,
              color: NOTION_ATTENDANCE.holiday.chipText,
              fontWeight: 600
            }}
          />
        ) : null}
        <Chip
          size="small"
          label={`Nincs jelentés: ${counts.nincs}`}
          variant="outlined"
          sx={{
            bgcolor: NOTION_ATTENDANCE.none.chipBg,
            borderColor: NOTION_ATTENDANCE.none.chipBorder,
            color: NOTION_ATTENDANCE.none.chipText,
            fontWeight: 600
          }}
        />
        {counts.odd > 0 ? (
          <Chip
            size="small"
            label={`Ellenőrizendő: ${counts.odd}`}
            variant="outlined"
            sx={{
              bgcolor: NOTION_ATTENDANCE.odd.chipBg,
              borderColor: NOTION_ATTENDANCE.odd.chipBorder,
              color: NOTION_ATTENDANCE.odd.chipText,
              fontWeight: 600
            }}
          />
        ) : null}
      </Box>

      <Box sx={{ maxHeight: { xs: 520, md: 440 }, overflowY: 'auto', pr: 0.5 }}>
        <Grid container spacing={1.5}>
          {orderedEmployees.map(emp => {
            const key = attendanceCardKey(emp)
            const st = NOTION_ATTENDANCE[key]
            return (
            <Grid item xs={12} sm={6} md={4} lg={2} key={emp.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: st.border,
                  bgcolor: st.bg,
                  borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  transition: theme.transitions.create(['box-shadow', 'border-color', 'background-color', 'transform'], {
                    duration: theme.transitions.duration.shortest
                  }),
                  '&:hover': {
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
                    borderColor: st.border,
                    bgcolor: st.hoverBg
                  }
                }}
              >
                  <CardContent
                    sx={{
                      py: 1,
                      px: 1.25,
                      '&:last-child': { pb: 1 }
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      component="div"
                      sx={{
                        color: '#37352F',
                        fontWeight: 700,
                        fontSize: '1rem',
                        lineHeight: 1.2,
                        mb: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em'
                      }}
                    >
                      {emp.name}
                    </Typography>
                    {emp.holiday_type ? (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'inline-block',
                          mb: 0.4,
                          px: 0.75,
                          py: 0.15,
                          borderRadius: '8px',
                          bgcolor: '#FFE2E2',
                          color: '#B71C1C',
                          border: '1px solid #F5B7B7',
                          fontWeight: 700
                        }}
                      >
                        {emp.holiday_type}
                        {emp.holiday_name ? ` - ${emp.holiday_name}` : ''}
                      </Typography>
                    ) : null}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.75,
                        flexWrap: 'nowrap'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.35, minWidth: 0, flex: 1 }}>
                        <Typography variant="caption" component="span" sx={{ color: '#6B6B6B', flexShrink: 0 }}>
                          Érkezés
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#37352F' }}
                        >
                          {emp.arrival ?? '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.35, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                        <Typography variant="caption" component="span" sx={{ color: '#6B6B6B', flexShrink: 0 }}>
                          Távozás
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#37352F' }}
                        >
                          {emp.departure ?? '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
              </Card>
            </Grid>
            )
          })}
        </Grid>
      </Box>
    </Box>
  )
}

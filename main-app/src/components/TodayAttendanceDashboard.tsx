'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

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

const EMPLOYEE_TYPE_ORDER = [
  'BOLTI_DOLGOZO',
  'MUHELY',
  'ASZTALOS',
  'LAPSZABASZ',
  'ELZARO',
  'IRODA'
] as const

/** Role accent for column headers (Notion board column style). */
const ROLE_ACCENT: Record<string, string> = {
  BOLTI_DOLGOZO: '#5B8DEF',
  IRODA: '#9B8FD9',
  MUHELY: '#787774',
  ASZTALOS: '#7CB89A',
  LAPSZABASZ: '#E8B86D',
  ELZARO: '#6BB8C9'
}

export type TodayAttendanceEmployee = {
  id: string
  name: string
  employee_code: string
  employee_type: string
  shift_start_time: string | null
  holiday_type: 'Szabadság' | 'Betegszabadság' | null
  holiday_name: string | null
  arrival: string | null
  departure: string | null
}

type EmployeeGroup = {
  type: string
  label: string
  displayLabel: string
  accent: string
  employees: TodayAttendanceEmployee[]
  counts: { bent: number; tavozott: number; holiday: number; nincs: number; odd: number }
}

function getEmployeeTypeLabel(type: string): string {
  switch (type) {
    case 'BOLTI_DOLGOZO':
      return 'Bolti Dolgozó'
    case 'LAPSZABASZ':
      return 'Lapszabász'
    case 'ELZARO':
      return 'Élzáró'
    case 'ASZTALOS':
      return 'Asztalos'
    case 'IRODA':
      return 'Iroda'
    case 'MUHELY':
    default:
      return 'Műhely'
  }
}

/** Readable column title (full words, no abbreviations). */
function getEmployeeTypeColumnLabel(type: string): string {
  switch (type) {
    case 'BOLTI_DOLGOZO':
      return 'Bolt'
    case 'LAPSZABASZ':
      return 'Lapszabászat'
    case 'ELZARO':
      return 'Élzárás'
    case 'ASZTALOS':
      return 'Asztalos'
    case 'IRODA':
      return 'Iroda'
    case 'MUHELY':
    default:
      return 'Műhely'
  }
}

function attendanceCardKey(emp: TodayAttendanceEmployee): NotionKey {
  const { arrival, departure, holiday_type } = emp
  if (holiday_type) return 'holiday'
  if (!arrival && departure) return 'odd'
  if (!arrival && !departure) return 'none'
  if (arrival && departure) return 'left'
  return 'in'
}

function sortEmployees(employees: TodayAttendanceEmployee[]): TodayAttendanceEmployee[] {
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
}

function countByStatus(employees: TodayAttendanceEmployee[]) {
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
}

function EmployeeCard({
  emp,
  onClick
}: {
  emp: TodayAttendanceEmployee
  onClick: (id: string) => void
}) {
  const theme = useTheme()
  const key = attendanceCardKey(emp)
  const st = NOTION_ATTENDANCE[key]

  return (
    <Card
      variant="outlined"
      onClick={() => onClick(emp.id)}
      sx={{
        cursor: 'pointer',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: st.border,
        bgcolor: st.bg,
        borderRadius: '12px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        transition: theme.transitions.create(['box-shadow', 'border-color', 'background-color'], {
          duration: theme.transitions.duration.shortest
        }),
        '&:hover': {
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
          borderColor: st.border,
          bgcolor: st.hoverBg
        }
      }}
    >
      <CardContent sx={{ py: 1, px: 1.1, '&:last-child': { pb: 1 } }}>
        <Typography
          variant="subtitle2"
          component="div"
          title={emp.name}
          sx={{
            color: '#37352F',
            fontWeight: 700,
            fontSize: '0.875rem',
            lineHeight: 1.2,
            mb: 0.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {emp.name}
        </Typography>

        {emp.holiday_type ? (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.35,
              px: 0.6,
              py: 0.1,
              borderRadius: '6px',
              bgcolor: '#FFE2E2',
              color: '#B71C1C',
              border: '1px solid #F5B7B7',
              fontWeight: 700,
              fontSize: '0.68rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {emp.holiday_type}
          </Typography>
        ) : (
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              color: '#37352F',
              fontSize: '0.75rem',
              lineHeight: 1.3
            }}
          >
            {emp.arrival ?? '—'} – {emp.departure ?? '—'}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

function RoleColumn({
  group,
  onEmployeeClick
}: {
  group: EmployeeGroup
  onEmployeeClick: (id: string) => void
}) {
  const hasEmployees = group.employees.length > 0

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        border: '1px solid #E8E7E4',
        borderRadius: '10px',
        overflow: 'hidden',
        bgcolor: '#FFFFFF'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: '#F7F6F3',
          borderBottom: '1px solid #ECEAE4',
          minHeight: 40
        }}
      >
        <Box
          sx={{
            width: 3,
            flexShrink: 0,
            bgcolor: group.accent
          }}
        />
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.75,
            px: 1.25,
            py: 0.875,
            minWidth: 0
          }}
        >
          <Typography
            component="div"
            title={group.label}
            sx={{
              color: '#37352F',
              fontWeight: 600,
              fontSize: '0.875rem',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              textAlign: 'left',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {group.displayLabel}
          </Typography>
          <Box
            component="span"
            sx={{
              flexShrink: 0,
              minWidth: 24,
              height: 22,
              px: 0.75,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              bgcolor: '#FFFFFF',
              border: '1px solid #E0DFDC',
              color: '#37352F',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1
            }}
          >
            {group.employees.length}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, p: 1 }}>
        {hasEmployees ? (
          group.employees.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} onClick={onEmployeeClick} />
          ))
        ) : (
          <Typography
            variant="caption"
            sx={{
              color: '#A8A6A1',
              textAlign: 'center',
              py: 2,
              fontSize: '0.75rem'
            }}
          >
            Nincs dolgozó
          </Typography>
        )}
      </Box>
    </Box>
  )
}

interface TodayAttendanceDashboardProps {
  dateLabel: string
  employees: TodayAttendanceEmployee[]
}

export default function TodayAttendanceDashboard({ dateLabel, employees }: TodayAttendanceDashboardProps) {
  const router = useRouter()

  const counts = useMemo(() => countByStatus(employees), [employees])

  const groups = useMemo(() => {
    const byType = new Map<string, TodayAttendanceEmployee[]>()

    for (const emp of employees) {
      const type = emp.employee_type || 'MUHELY'
      const list = byType.get(type) ?? []
      list.push(emp)
      byType.set(type, list)
    }

    return EMPLOYEE_TYPE_ORDER.map(type => {
      const list = byType.get(type) ?? []
      return {
        type,
        label: getEmployeeTypeLabel(type),
        displayLabel: getEmployeeTypeColumnLabel(type),
        accent: ROLE_ACCENT[type] ?? ROLE_ACCENT.MUHELY,
        employees: sortEmployees(list),
        counts: countByStatus(list)
      }
    })
  }, [employees])

  const handleEmployeeClick = (id: string) => {
    router.push(`/employees/${id}`)
  }

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
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1,
          mb: 2
        }}
      >
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

      <Grid container spacing={1.5} alignItems="stretch">
        {groups.map(group => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={group.type}>
            <RoleColumn group={group} onEmployeeClick={handleEmployeeClick} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

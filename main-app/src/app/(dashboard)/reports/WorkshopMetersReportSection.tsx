'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ApexOptions } from 'apexcharts'
import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

type WorkshopMachine = {
  id: string
  name: string
  machine_type: 'edge_bander' | 'panel_saw' | string
}

type DayPoint = {
  date: string
  abs: number | null
  deltaM: number | null
  missing: boolean
}

type SeriesEntry = {
  machine: WorkshopMachine
  points: DayPoint[]
}

type ApiResponse = {
  start: string
  end: string
  machines: WorkshopMachine[]
  series: Record<string, SeriesEntry>
  totalsByType: {
    edge_bander: number
    panel_saw: number
  }
}

function budapestDateKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function addDaysIso(yyyyMmDd: string, days: number) {
  // yyyyMmDd is a calendar day string; we shift using UTC date parts derived from the string
  const y = Number(yyyyMmDd.slice(0, 4))
  const m = Number(yyyyMmDd.slice(5, 7))
  const d = Number(yyyyMmDd.slice(8, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

const fmtMetersInt = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} m`

const LINE_COLORS = ['#0B6E99', '#E67E22', '#6C5CE7', '#16A085', '#2D3436', '#8E44AD']
const C_TYPE_SUM_EDGE = '#111111'
const C_TYPE_SUM_SAW = '#111111'

function makeLineOptions(categories: string[], title: string, fmtY: (n: number) => string): ApexOptions {
  return {
    chart: { type: 'line', height: 260, toolbar: { show: false }, fontFamily: 'inherit' },
    dataLabels: { enabled: false },
    stroke: { width: 2, curve: 'straight' },
    xaxis: {
      type: 'category',
      categories,
      labels: { rotate: -45, style: { fontSize: '11px' } }
    },
    yaxis: { labels: { formatter: v => fmtY(Number(v)) } },
    markers: { size: 3 },
    legend: { position: 'top' as const, fontSize: '12px' },
    grid: { strokeDashArray: 3, borderColor: '#E3E2DD' },
    tooltip: { y: { formatter: v => fmtY(Number(v)) } },
    title: { text: title, style: { fontSize: '13px', fontWeight: 700 } }
  }
}

export default function WorkshopMetersReportSection() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7)
  const [includeExec, setIncludeExec] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = useMemo(() => {
    const endD = budapestDateKey(new Date())
    const startD = addDaysIso(endD, -(rangeDays - 1))
    return { start: startD, end: endD }
  }, [rangeDays])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/reports/workshop-meters?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { credentials: 'include' }
      )
      const j = (await res.json()) as any
      if (!res.ok) throw new Error(j?.error || res.statusText)
      setData(j as ApiResponse)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Nem sikerült betölteni')
    } finally {
      setLoading(false)
    }
  }, [end, start])

  useEffect(() => {
    load()
  }, [load])

  const chartPack = useMemo(() => {
    if (!data) {
      return {
        categories: [] as string[],
        edge: { options: makeLineOptions([], 'Élzáró — napi produkció (m)', fmtMetersInt), series: [] as Array<{ name: string; data: Array<number | null> }> },
        saw: { options: makeLineOptions([], 'Lapszabászgép — napi produkció (m)', fmtMetersInt), series: [] as Array<{ name: string; data: Array<number | null> }> }
      }
    }

    // categories: based on the first available machine series
    const firstId = data.machines[0]?.id
    const firstSeries = firstId ? data.series[firstId] : null
    const cats = firstSeries?.points.map(p => p.date.slice(5)) ?? []

    const edgeMachines = data.machines.filter(m => m.machine_type === 'edge_bander')
    const saws = data.machines.filter(m => m.machine_type === 'panel_saw')

    const buildPerMachine = (ms: WorkshopMachine[], colorOffset: number) =>
      ms.map((m, idx) => {
        const pts = data.series[m.id]?.points ?? []
        return {
          name: m.name,
          data: pts.map(p => (p.missing || p.deltaM === null ? null : p.deltaM)),
          color: LINE_COLORS[(idx + colorOffset) % LINE_COLORS.length]
        }
      })

    const buildTypeSum = (ms: WorkshopMachine[], color: string) => {
      if (ms.length === 0) return null
      const n = firstSeries?.points.length ?? 0
      const out: Array<number | null> = new Array(n).fill(null)
      for (let i = 0; i < n; i++) {
        let sum = 0
        let any = false
        for (const m of ms) {
          const p = data.series[m.id]?.points[i]
          if (!p) continue
          if (!p.missing && p.deltaM !== null) {
            any = true
            sum += p.deltaM
          }
        }
        out[i] = any ? sum : null
      }
      return { name: 'Összesen (típus)', data: out, color }
    }

    const es = buildPerMachine(edgeMachines, 0)
    const ss = buildPerMachine(saws, 2)
    const eSum = buildTypeSum(edgeMachines, C_TYPE_SUM_EDGE)
    const sSum = buildTypeSum(saws, C_TYPE_SUM_SAW)

    const edgeList = includeExec && eSum ? [eSum, ...es] : es
    const sawList = includeExec && sSum ? [sSum, ...ss] : ss

    const edgeOpts = {
      ...makeLineOptions(cats, 'Élzáró — napi produkció (m)', fmtMetersInt),
      colors: edgeList.map(s => s.color)
    }
    const sawOpts = {
      ...makeLineOptions(cats, 'Lapszabászgép — napi produkció (m)', fmtMetersInt),
      colors: sawList.map(s => s.color)
    }

    return {
      categories: cats,
      edge: { options: edgeOpts, series: edgeList.map(s => ({ name: s.name, data: s.data })) },
      saw: { options: sawOpts, series: sawList.map(s => ({ name: s.name, data: s.data })) }
    }
  }, [data, includeExec])

  return (
    <Paper variant='outlined' sx={{ p: 2, mb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant='h6' sx={{ fontWeight: 800, mb: 0.5 }}>
            Műhely — napi produkció (méter)
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            A görbe a napi <strong>delta</strong> (odométer-szerű): előző rögzített naphoz képest. Hiányzó napoknál nincs pont.
            {data ? (
              <>
                {' '}
                <span>
                  (Összeg: Élzáró {fmtMetersInt(data.totalsByType.edge_bander)} • Lapszabász {fmtMetersInt(data.totalsByType.panel_saw)} • Időszak: {data.start} → {data.end})
                </span>
              </>
            ) : null}
          </Typography>
        </Box>

        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
          <ToggleButtonGroup
            size='small'
            exclusive
            value={rangeDays}
            onChange={(_e, v) => v && setRangeDays(v)}
          >
            <ToggleButton value={7} sx={{ textTransform: 'none' }}>
              7 nap
            </ToggleButton>
            <ToggleButton value={30} sx={{ textTransform: 'none' }}>
              30 nap
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup size='small' value={includeExec ? 'on' : 'off'} exclusive onChange={(_e, v) => setIncludeExec(v === 'on')}>
            <ToggleButton value='off' sx={{ textTransform: 'none' }}>
              Gépenként
            </ToggleButton>
            <ToggleButton value='on' sx={{ textTransform: 'none' }}>
              + típus összeg
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {error && (
        <Typography color='error' sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}
      {loading && !data && <Typography color='text.secondary'>Betöltés…</Typography>}

      {data && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <ReactApexChart
              type='line'
              height={300}
              options={chartPack.edge.options}
              series={chartPack.edge.series}
            />
          </Box>
          <Box>
            <ReactApexChart
              type='line'
              height={300}
              options={chartPack.saw.options}
              series={chartPack.saw.series}
            />
          </Box>
        </Box>
      )}
    </Paper>
  )
}

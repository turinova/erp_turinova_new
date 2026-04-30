'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, CircularProgress, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <CircularProgress />
})

type BarSeries = { name: string; data: number[] }

interface ChartData {
  categories: string[]
  series: BarSeries[]
  dailyTotals?: number[]
  remainingTotals?: number[]
  doneTotals?: number[]
  capacityPerDay?: number[]
  weekStart?: string
  weekEnd?: string
}

interface WeeklyEdgeBandingChartProps {
  initialData?: ChartData
}

export default function WeeklyEdgeBandingChart({ initialData }: WeeklyEdgeBandingChartProps) {
  const theme = useTheme()
  const [chartData, setChartData] = useState<ChartData | null>(initialData || null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    if (weekOffset !== 0 || !initialData) {
      fetchChartData(weekOffset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const fetchChartData = async (offset: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dashboard/weekly-edge-banding?weekOffset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch chart data')
      const data = await response.json()
      setChartData(data)
    } catch (err) {
      console.error('Error fetching chart data:', err)
      setError('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousWeek = () => setWeekOffset(prev => prev - 1)
  const handleNextWeek = () => setWeekOffset(prev => prev + 1)
  const handleCurrentWeek = () => setWeekOffset(0)

  const formatDateRange = () => {
    if (!chartData?.weekStart || !chartData?.weekEnd) return ''
    const start = new Date(chartData.weekStart)
    const end = new Date(chartData.weekEnd)
    return `${start.getFullYear()}. ${String(start.getMonth() + 1).padStart(2, '0')}. ${String(start.getDate()).padStart(2, '0')}. - ${String(
      end.getMonth() + 1
    ).padStart(2, '0')}. ${String(end.getDate()).padStart(2, '0')}.`
  }

  const hasAnyBars = useMemo(() => {
    const s = chartData?.series || []
    return s.some(x => (x.data || []).some(v => Number(v) > 0))
  }, [chartData])

  const baseCategories = Array.isArray(chartData?.categories) && chartData!.categories.length > 0
    ? chartData!.categories
    : ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

  const categories = baseCategories.map((day, index) => {
    const total = chartData?.dailyTotals?.[index] || 0
    const parts = []
    if (total > 0) parts.push(`${total.toFixed(0)}m`)
    return parts.length ? `${day}\n(${parts.join(', ')})` : day
  })

  const mixedSeries = useMemo(() => {
    const bars = chartData?.series || []
    const cap = chartData?.capacityPerDay || [700, 700, 700, 700, 700, 700]
    const remaining = chartData?.remainingTotals || [0, 0, 0, 0, 0, 0]

    return [
      ...bars.map(s => ({ ...s, type: 'bar' as const })),
      { name: 'Hátralévő', data: remaining, type: 'line' as const },
      { name: 'Kapacitás', data: cap, type: 'line' as const }
    ]
  }, [chartData])

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    )
  }

  if (!chartData || !hasAnyBars) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'success.main' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Heti élzárás mennyiség
          </Typography>
          <Typography color="text.secondary">Nincs gyártásban lévő rendelés élzáró igénnyel erre a hétre</Typography>
        </CardContent>
      </Card>
    )
  }

  const chartOptions: any = {
    chart: {
      type: 'line',
      height: 400,
      stacked: true,
      toolbar: { show: false },
      fontFamily: theme.typography.fontFamily
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 8,
        borderRadiusApplication: 'end'
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      width: [
        ...(chartData.series || []).map(() => 0),
        3,
        3
      ],
      dashArray: [
        ...(chartData.series || []).map(() => 0),
        0,
        6
      ],
      curve: 'straight'
    },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: '13px', fontWeight: 500 }
      }
    },
    yaxis: {
      title: {
        text: 'Élzárás hossz (m)',
        style: { fontSize: '14px', fontWeight: 600 }
      },
      labels: {
        formatter: (val: number) => `${val.toFixed(0)}m`,
        style: { fontSize: '12px' }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '13px',
      fontWeight: 500,
      markers: { width: 10, height: 10, radius: 3 }
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      theme: theme.palette.mode,
      shared: true,
      intersect: false,
      custom: ({ series, dataPointIndex, w }: { series: number[][]; dataPointIndex: number; w: any }) => {
        const dayLabel = baseCategories?.[dataPointIndex] || ''
        const total = chartData?.dailyTotals?.[dataPointIndex] || 0
        const done = chartData?.doneTotals?.[dataPointIndex] || 0
        const remaining = chartData?.remainingTotals?.[dataPointIndex] || 0

        const rows: string[] = []
        for (let i = 0; i < w.globals.seriesNames.length; i++) {
          const name = String(w.globals.seriesNames[i] || '')
          const value = Number(series?.[i]?.[dataPointIndex] ?? 0)
          if (!value || value <= 0) continue
          rows.push(`<div style="display:flex;justify-content:space-between;gap:12px;"><span>${name}</span><strong>${value.toFixed(2)} m</strong></div>`)
        }

        const header = `<div style="font-weight:600;margin-bottom:6px;">${dayLabel}</div>`
        const summary = `
          <div style="display:flex;justify-content:space-between;gap:12px;"><span>Össz</span><strong>${total.toFixed(0)} m</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;"><span>Kész</span><strong>${done.toFixed(0)} m</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;"><span>Hátra</span><strong>${remaining.toFixed(0)} m</strong></div>
        `

        const divider = rows.length ? `<div style="margin:8px 0;border-top:1px solid rgba(127,127,127,0.35);"></div>` : ''
        return `<div style="padding:10px 12px;min-width:220px;">${header}${summary}${divider}${rows.join('')}</div>`
      },
      y: {
        formatter: (val: number) => `${val.toFixed(2)} m`
      }
    },
    grid: {
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    }
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'success.main' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Heti élzárás mennyiség
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePreviousWeek} size="small" sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ px: 2, py: 0.5, bgcolor: 'success.lighter', borderRadius: 1, minWidth: 220, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDateRange()}
              </Typography>
            </Box>
            <IconButton onClick={handleNextWeek} size="small" sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
              <ChevronRightIcon />
            </IconButton>
            <IconButton
              onClick={handleCurrentWeek}
              size="small"
              disabled={weekOffset === 0}
              sx={{
                ml: 1,
                bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'success.main',
                color: weekOffset === 0 ? 'action.disabled' : 'success.contrastText',
                '&:hover': { bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'success.dark' }
              }}
              title="Vissza az aktuális hétre"
            >
              <TodayIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ width: '100%', height: 450 }}>
          <ReactApexChart options={chartOptions} series={mixedSeries} type="line" height={400} />
        </Box>
      </CardContent>
    </Card>
  )
}


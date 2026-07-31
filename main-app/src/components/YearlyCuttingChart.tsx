'use client'

import React from 'react'
import { Card, CardContent, Typography, Box, CircularProgress, LinearProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import type { YearlyCuttingData } from '@/lib/dashboard-server'

// Dynamically import ApexCharts with no SSR
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <CircularProgress />
})

/** Minimum havi célszámok (méter), évente bővítendő */
const MONTHLY_TARGETS: Record<number, number[]> = {
  2026: [
    22849.92, 17626.19, 18808.82, 19769.16, 18733.71, 17278.39,
    23786.19, 20035.55, 23098.23, 22154.78, 22023.27, 17183.72
  ]
}

const COLOR_DEFAULT = '#2196F3' // in-progress / no target
const COLOR_ABOVE = '#4CAF50' // closed month, target reached
const COLOR_BELOW = '#F44336' // closed month, below target
const COLOR_GOAL = '#37474F' // target marker line

interface YearlyCuttingChartProps {
  data: YearlyCuttingData
}

export default function YearlyCuttingChart({ data }: YearlyCuttingChartProps) {
  const theme = useTheme()

  const targets = MONTHLY_TARGETS[data.year]
  const hasData = data.data.some(value => value > 0)

  if (!hasData && !targets) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Éves szabás mennyiség — {data.year}
          </Typography>
          <Typography color="text.secondary">
            Nincs gyártási adat erre az évre
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const now = new Date()
  const currentMonthIndex = now.getFullYear() === data.year ? now.getMonth() : 12

  const seriesData = data.data.map((value, i) => {
    const target = targets?.[i]
    const isClosedMonth = i < currentMonthIndex

    let fillColor = COLOR_DEFAULT
    if (target != null && isClosedMonth) {
      fillColor = value >= target ? COLOR_ABOVE : COLOR_BELOW
    }

    return {
      x: data.categories[i],
      y: value,
      fillColor,
      goals: target != null
        ? [
            {
              name: 'Havi cél',
              value: target,
              strokeHeight: 3,
              strokeWidth: 24,
              strokeColor: COLOR_GOAL,
              strokeDashArray: 0,
              strokeLineCap: 'round'
            }
          ]
        : undefined
    }
  })

  const series = [
    {
      name: 'Szabás',
      data: seriesData
    }
  ]

  // Goals don't always extend the y-axis range, so include targets explicitly
  const maxY = Math.max(...data.data, ...(targets || [0]))

  const yearlyTarget = targets ? targets.reduce((sum, t) => sum + t, 0) : 0
  const yearlyProgress = yearlyTarget > 0 ? (data.totalMeters / yearlyTarget) * 100 : 0

  // Time-proportional expected progress: closed months in full + current month pro-rated by day
  let expectedToDate = 0
  if (targets) {
    for (let i = 0; i < currentMonthIndex && i < 12; i++) {
      expectedToDate += targets[i]
    }
    if (currentMonthIndex >= 0 && currentMonthIndex < 12) {
      const daysInMonth = new Date(data.year, currentMonthIndex + 1, 0).getDate()
      expectedToDate += targets[currentMonthIndex] * (now.getDate() / daysInMonth)
    }
  }
  const expectedProgress = yearlyTarget > 0 ? (expectedToDate / yearlyTarget) * 100 : 0
  const paceDiff = data.totalMeters - expectedToDate
  const isAhead = paceDiff >= 0

  const chartOptions: any = {
    chart: {
      type: 'bar',
      height: 400,
      toolbar: {
        show: false
      },
      fontFamily: theme.typography.fontFamily
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 8,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: data.categories,
      labels: {
        style: {
          fontSize: '13px',
          fontWeight: 500
        }
      }
    },
    yaxis: {
      min: 0,
      max: Math.ceil(maxY * 1.15),
      title: {
        text: 'Vágási hossz (m)',
        style: {
          fontSize: '14px',
          fontWeight: 600
        }
      },
      labels: {
        formatter: function (val: number) {
          return val.toFixed(0) + 'm'
        },
        style: {
          fontSize: '12px'
        }
      }
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      theme: theme.palette.mode,
      shared: false,
      intersect: false,
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const monthLabel = data.categories[dataPointIndex] || ''
        const value = data.data[dataPointIndex] || 0
        const target = targets?.[dataPointIndex]

        const rows = [
          `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Szabás</span><strong>${value.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m</strong></div>`
        ]
        if (target != null) {
          const diff = value - target
          rows.push(
            `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Havi cél</span><strong>${target.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m</strong></div>`,
            `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Eltérés</span><strong style="color:${diff >= 0 ? COLOR_ABOVE : COLOR_BELOW};">${diff >= 0 ? '+' : ''}${diff.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m</strong></div>`
          )
        }

        return `<div style="padding:10px 12px;min-width:220px;"><div style="font-weight:600;margin-bottom:6px;">${monthLabel}</div>${rows.join('')}</div>`
      }
    },
    legend: {
      show: false
    },
    colors: [COLOR_DEFAULT],
    grid: {
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    }
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'info.main' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Éves szabás mennyiség — {data.year}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {targets && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 18, height: 3, borderRadius: 2, bgcolor: COLOR_GOAL }} />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Havi cél</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: COLOR_ABOVE }} />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Cél felett</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: COLOR_BELOW }} />
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Cél alatt</Typography>
                </Box>
              </Box>
            )}
            <Box
              sx={{
                px: 2,
                py: 0.5,
                bgcolor: 'primary.lighter',
                borderRadius: 1,
                textAlign: 'center'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Összesen: {data.totalMeters.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m
              </Typography>
            </Box>
          </Box>
        </Box>
        {yearlyTarget > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Éves cél teljesítése
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: isAhead ? COLOR_ABOVE : COLOR_BELOW }}
                >
                  {isAhead ? 'Cél előtt: +' : 'Lemaradás: −'}
                  {Math.abs(paceDiff).toLocaleString('hu-HU', { maximumFractionDigits: 0 })} m
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {data.totalMeters.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} m
                {' / '}
                {yearlyTarget.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} m
                {' · '}
                {yearlyProgress.toFixed(1)}%
              </Typography>
            </Box>
            <Box sx={{ position: 'relative' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, yearlyProgress)}
                sx={{
                  height: 20,
                  borderRadius: 10,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: isAhead ? COLOR_ABOVE : COLOR_BELOW,
                    borderRadius: 10
                  }
                }}
              />
              {/* Time-proportional expected position marker */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -3,
                  bottom: -3,
                  left: `${Math.min(100, expectedProgress)}%`,
                  width: '3px',
                  transform: 'translateX(-50%)',
                  bgcolor: COLOR_GOAL,
                  borderRadius: 1,
                  zIndex: 1
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                A jelölő az időarányosan elvárt szintet mutatja ({expectedToDate.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} m · {expectedProgress.toFixed(1)}%)
              </Typography>
            </Box>
          </Box>
        )}
        <Box sx={{ width: '100%', height: 450 }}>
          <ReactApexChart
            options={chartOptions}
            series={series}
            type="bar"
            height={400}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

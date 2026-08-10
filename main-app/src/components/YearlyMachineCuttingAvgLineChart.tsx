'use client'

import React from 'react'
import { Box, Card, CardContent, CircularProgress, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import type { YearlyMachineCuttingAvgLineData } from '@/lib/dashboard-server'

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <CircularProgress />
})

const SERIES_COLORS = ['#1976D2', '#388E3C', '#F57C00', '#7B1FA2', '#00838F']

interface YearlyMachineCuttingAvgLineChartProps {
  data: YearlyMachineCuttingAvgLineData
}

export default function YearlyMachineCuttingAvgLineChart({
  data
}: YearlyMachineCuttingAvgLineChartProps) {
  const theme = useTheme()
  const hasData = data.series.some(s => s.data.some(v => v > 0))

  if (!hasData) {
    return (
      <Card>
        <CardContent>
          <Typography variant='h6' gutterBottom>
            Gépenkénti átlag szabás — {data.year}
          </Typography>
          <Typography color='text.secondary'>
            Nincs kész (ready_at) H–P adat erre az évre
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const series = data.series.map(s => ({
    name: s.name,
    data: s.data
  }))

  const chartOptions: any = {
    chart: {
      type: 'line',
      height: 400,
      toolbar: { show: false },
      fontFamily: theme.typography.fontFamily,
      zoom: { enabled: false }
    },
    colors: SERIES_COLORS,
    stroke: {
      curve: 'smooth',
      width: 3
    },
    markers: {
      size: 4,
      hover: { size: 6 }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.categories,
      labels: {
        style: { fontSize: '13px', fontWeight: 500 }
      }
    },
    yaxis: {
      min: 0,
      title: {
        text: 'Átlag szabás (m/nap)',
        style: { fontSize: '14px', fontWeight: 600 }
      },
      labels: {
        formatter: (val: number) => `${Math.round(val)} m`,
        style: { fontSize: '12px' }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '13px',
      fontWeight: 500
    },
    tooltip: {
      theme: theme.palette.mode,
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number, opts: { seriesIndex: number }) => {
          const machine = data.series[opts.seriesIndex]
          const limit =
            machine?.dailyLimitM != null
              ? ` · cél ${machine.dailyLimitM.toLocaleString('hu-HU')} m/nap`
              : ''
          return `${Number(val || 0).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m/nap${limit}`
        }
      }
    },
    grid: {
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    }
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant='h5' sx={{ fontWeight: 600 }}>
            Gépenkénti átlag szabás — {data.year}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            ready_at · H–P · havi átlag = össz. m ÷ napok ahol volt kész munka
          </Typography>
        </Box>
        <Box sx={{ width: '100%', height: 420 }}>
          <ReactApexChart options={chartOptions} series={series} type='line' height={400} />
        </Box>
      </CardContent>
    </Card>
  )
}

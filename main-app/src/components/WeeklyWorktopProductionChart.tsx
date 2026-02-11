'use client'

import React, { useEffect, useState } from 'react'
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

interface ChartData {
  categories: string[]
  series: {
    name: string
    data: number[]
  }[]
  dailyTotals?: number[]
  weekStart?: string
  weekEnd?: string
}

interface WeeklyWorktopProductionChartProps {
  initialData?: ChartData
}

export default function WeeklyWorktopProductionChart({ initialData }: WeeklyWorktopProductionChartProps) {
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
      const response = await fetch(`/api/dashboard/weekly-worktop-production?weekOffset=${offset}`)
      if (!response.ok) {
        throw new Error('Failed to fetch chart data')
      }
      const data = await response.json()
      setChartData(data)
    } catch (err) {
      console.error('Error fetching chart data:', err)
      setError('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousWeek = () => {
    setWeekOffset(prev => prev - 1)
  }

  const handleNextWeek = () => {
    setWeekOffset(prev => prev + 1)
  }

  const handleCurrentWeek = () => {
    setWeekOffset(0)
  }

  const formatDateRange = () => {
    if (!chartData?.weekStart || !chartData?.weekEnd) return ''
    const start = new Date(chartData.weekStart)
    const end = new Date(chartData.weekEnd)
    return `${start.getFullYear()}. ${String(start.getMonth() + 1).padStart(2, '0')}. ${String(start.getDate()).padStart(2, '0')}. - ${String(end.getMonth() + 1).padStart(2, '0')}. ${String(end.getDate()).padStart(2, '0')}.`
  }

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

  if (!chartData || !chartData.series || chartData.series.length === 0 || chartData.series[0].data.every(val => val === 0)) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'warning.main' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Heti munkalap gyártás mennyiség
          </Typography>
          <Typography color="text.secondary">
            Nincs gyártásban lévő munkalap megrendelés erre a hétre
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const baseCategories = Array.isArray(chartData.categories) && chartData.categories.length > 0 
    ? chartData.categories 
    : ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

  const categories = baseCategories.map((day, index) => {
    const total = chartData.dailyTotals?.[index] || 0
    return total > 0 ? `${day}\n(${total} db)` : day
  })

  const chartOptions: any = {
    chart: {
      type: 'bar',
      height: 400,
      toolbar: {
        show: false
      },
      fontFamily: theme.typography.fontFamily,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 8,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val > 0 ? val + ' db' : ''
      },
      offsetY: -25,
      style: {
        fontSize: '12px',
        fontWeight: 600
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          fontSize: '13px',
          fontWeight: 500
        }
      }
    },
    yaxis: {
      title: {
        text: 'Megrendelések száma',
        style: {
          fontSize: '14px',
          fontWeight: 600
        }
      },
      labels: {
        formatter: function (val: number) {
          return val.toFixed(0) + ' db'
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
      y: {
        formatter: function (val: number) {
          return val + ' megrendelés'
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '13px',
      fontWeight: 500
    },
    colors: ['#FF9800'], // Orange color for in_production
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
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'warning.main' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Heti munkalap gyártás mennyiség
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={handlePreviousWeek}
              size="small"
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ 
              px: 2, 
              py: 0.5, 
              bgcolor: 'warning.lighter',
              borderRadius: 1,
              minWidth: 220,
              textAlign: 'center'
            }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatDateRange()}
              </Typography>
            </Box>
            <IconButton 
              onClick={handleNextWeek}
              size="small"
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ChevronRightIcon />
            </IconButton>
            <IconButton 
              onClick={handleCurrentWeek}
              size="small"
              disabled={weekOffset === 0}
              sx={{ 
                ml: 1,
                bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'warning.main',
                color: weekOffset === 0 ? 'action.disabled' : 'warning.contrastText',
                '&:hover': { 
                  bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'warning.dark' 
                }
              }}
              title="Vissza az aktuális hétre"
            >
              <TodayIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ width: '100%', height: 450 }}>
          <ReactApexChart
            options={chartOptions}
            series={chartData.series}
            type="bar"
            height={400}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

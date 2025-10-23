'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Box, CircularProgress, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'

// Dynamically import ApexCharts with no SSR
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
  machineLimits?: {
    machineId: string
    machineName: string
    limit: number
  }[]
  dailyTotals?: number[]
  weekStart?: string
  weekEnd?: string
}

export default function WeeklyCuttingChart() {
  const theme = useTheme()
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = previous week, +1 = next week

  useEffect(() => {
    fetchChartData(weekOffset)
  }, [weekOffset])

  const fetchChartData = async (offset: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dashboard/weekly-cutting?weekOffset=${offset}`)
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

  if (!chartData || !chartData.series || chartData.series.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Heti szabás mennyiség
          </Typography>
          <Typography color="text.secondary">
            Nincs gyártásban lévő megrendelés erre a hétre
          </Typography>
        </CardContent>
      </Card>
    )
  }

  // Simple approach: bars turn red when over limit
  const validSeries = chartData.series.map((s, machineIndex) => {
    const machineLimit = chartData.machineLimits?.[machineIndex]?.limit || Infinity
    const seriesData = Array.isArray(s.data) ? s.data : [0, 0, 0, 0, 0, 0]
    
    return {
      name: s.name || 'Unknown',
      data: seriesData.map((value: number) => {
        const isOverLimit = value > machineLimit
        
        return {
          x: '', // Empty x value
          y: value,
          fillColor: isOverLimit ? '#F44336' : undefined, // Red if over limit
          goals: isOverLimit ? [{
            name: 'Limit',
            value: machineLimit,
            strokeHeight: 4,
            strokeWidth: 10,
            strokeColor: '#FFFFFF',
            strokeDashArray: 0,
            strokeLineCap: 'butt'
          }] : undefined
        }
      })
    }
  })

  // Ensure categories is valid (Monday to Saturday only)
  const baseCategories = Array.isArray(chartData.categories) && chartData.categories.length > 0 
    ? chartData.categories 
    : ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

  // Add daily totals under each day label
  const categories = baseCategories.map((day, index) => {
    const total = chartData.dailyTotals?.[index] || 0
    return total > 0 ? `${day}\n(${total.toFixed(1)}m)` : day
  })

  const chartOptions: any = {
    chart: {
      type: 'bar',
      height: 400,
      stacked: false, // Turn off stacking - use gradient instead
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
        distributed: false, // Keep machines grouped by day
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val > 0 ? val.toFixed(1) + 'm' : ''
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
      y: {
        formatter: function (val: number) {
          return val.toFixed(2) + ' méter'
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '13px',
      fontWeight: 500,
      markers: {
        width: 10,
        height: 10,
        radius: 3
      }
    },
    colors: [
      '#2196F3', // Bright Blue
      '#4CAF50', // Bright Green
      '#FF9800', // Bright Orange
      '#E91E63', // Bright Pink
      '#9C27B0', // Bright Purple
      '#00BCD4', // Bright Cyan
      '#FFEB3B', // Bright Yellow
      '#FF5722', // Bright Deep Orange
    ],
    annotations: {
      yaxis: [] // No annotations needed
    },
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Heti szabás mennyiség
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
              bgcolor: 'primary.lighter',
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
                bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'primary.main',
                color: weekOffset === 0 ? 'action.disabled' : 'primary.contrastText',
                '&:hover': { 
                  bgcolor: weekOffset === 0 ? 'action.disabledBackground' : 'primary.dark' 
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
            series={validSeries}
            type="bar"
            height={400}
          />
        </Box>
      </CardContent>
    </Card>
  )
}


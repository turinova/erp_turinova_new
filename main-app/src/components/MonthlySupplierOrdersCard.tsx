'use client'

import React, { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  Grid,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'

interface StatusData {
  status: string
  label: string
  count: number
  percentage: number
  color: string
}

type TimeRange = 'month' | 'week' | 'day'

interface SupplierOrdersSummaryData {
  statusData: StatusData[]
  total: number
  range: TimeRange
  offset: number
  label: string
  startDate?: string
  endDate?: string
}

export default function MonthlySupplierOrdersCard() {
  const [data, setData] = useState<SupplierOrdersSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('month')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    fetchData(range, offset)
  }, [range, offset])

  const fetchData = async (selectedRange: TimeRange, selectedOffset: number) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/dashboard/monthly-supplier-orders?range=${selectedRange}&offset=${selectedOffset}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching monthly supplier orders data:', err)
      setError('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevious = () => {
    setOffset(prev => prev - 1)
  }

  const handleNext = () => {
    setOffset(prev => prev + 1)
  }

  const handleCurrent = () => {
    setOffset(0)
  }

  const handleRangeChange = (_event: React.SyntheticEvent, value: TimeRange | null) => {
    if (value) {
      setRange(value)
      setOffset(0)
    }
  }

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: '2px solid', borderColor: 'warning.main' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Beszállítói megrendelések
          </Typography>
          <ToggleButtonGroup
            value={range}
            exclusive
            size="small"
            onChange={handleRangeChange}
          >
            <ToggleButton value="day">Napi</ToggleButton>
            <ToggleButton value="week">Heti</ToggleButton>
            <ToggleButton value="month">Havi</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 3 }}>
          <IconButton onClick={handlePrevious} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
              {data.label}
            </Typography>
          </Box>
          <IconButton onClick={handleNext} size="small">
            <ChevronRightIcon />
          </IconButton>
          <IconButton
            onClick={handleCurrent}
            size="small"
            disabled={offset === 0}
            color="primary"
          >
            <TodayIcon />
          </IconButton>
        </Box>

        {/* Status items */}
        <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
          {data.statusData.map((item) => (
            <Grid item xs={6} sm={4} md={2.4} key={item.status}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1
              }}>
                {/* Circular Progress */}
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  {/* Background circle - light grey */}
                  <CircularProgress
                    variant="determinate"
                    value={100}
                    size={75}
                    thickness={5}
                    sx={{
                      color: '#E0E0E0',
                      position: 'absolute',
                      left: 0
                    }}
                  />
                  {/* Actual progress circle - colored */}
                  <CircularProgress
                    variant="determinate"
                    value={item.percentage}
                    size={75}
                    thickness={5}
                    sx={{
                      color: item.color,
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round'
                      }
                    }}
                  />
                  {/* Count and percentage in center */}
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: 'absolute',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 800,
                        color: item.color,
                        lineHeight: 1,
                        fontSize: '1.25rem'
                      }}
                    >
                      {item.count}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontSize: '0.65rem',
                        color: 'text.secondary',
                        fontWeight: 600,
                        mt: 0.3
                      }}
                    >
                      {item.percentage.toFixed(0)}%
                    </Typography>
                  </Box>
                </Box>

                {/* Label */}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600,
                    color: 'text.primary',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    lineHeight: 1.2
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}


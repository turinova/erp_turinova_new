'use client'

import React, { useEffect, useState } from 'react'
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  CircularProgress, 
  IconButton,
  Grid
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

interface MonthlyQuotesData {
  statusData: StatusData[]
  total: number
  month: string
  year: number
  monthOffset: number
}

export default function MonthlyQuotesCard() {
  const [data, setData] = useState<MonthlyQuotesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = current month, -1 = previous, +1 = next

  useEffect(() => {
    fetchData(monthOffset)
  }, [monthOffset])

  const fetchData = async (offset: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dashboard/monthly-quotes?monthOffset=${offset}`)
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching monthly quotes data:', err)
      setError('Hiba az adatok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => {
    setMonthOffset(prev => prev - 1)
  }

  const handleNextMonth = () => {
    setMonthOffset(prev => prev + 1)
  }

  const handleCurrentMonth = () => {
    setMonthOffset(0)
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
        {/* Header with month navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Lapszabászati megrendelések
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton 
              onClick={handlePreviousMonth}
              size="small"
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
              {data.year}. {data.month}
            </Typography>
            <IconButton 
              onClick={handleNextMonth}
              size="small"
            >
              <ChevronRightIcon />
            </IconButton>
            <IconButton 
              onClick={handleCurrentMonth}
              size="small"
              disabled={monthOffset === 0}
              color="primary"
            >
              <TodayIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Status items with circular progress - Grid layout like "Topics" */}
        <Grid container spacing={2.5} sx={{ justifyContent: 'center' }}>
          {data.statusData.map((item) => (
            <Grid item xs={4} sm={3} md={2} key={item.status}>
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


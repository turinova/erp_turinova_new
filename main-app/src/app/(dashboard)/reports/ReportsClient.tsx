'use client'

import React, { useEffect, useMemo, useState } from 'react'

import NextLink from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

import type { ApexOptions } from 'apexcharts'

import {
  Box,
  Breadcrumbs,
  CircularProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { Home as HomeIcon, Assessment as AssessmentIcon } from '@mui/icons-material'

import { usePagePermission } from '@/hooks/usePagePermission'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

type RangeType = 'day' | 'week' | 'month'

interface RevenueDatum {
  date: string
  total: number
}

interface RevenueTopItem {
  customer_id: string
  customer_name: string
  total: number
}

interface RevenueResponse {
  range: RangeType
  data: RevenueDatum[]
  toplist: RevenueTopItem[]
  month?: {
    year: number
    month: number
    label?: string
    iso?: string
  }
  availableMonths?: string[]
}

interface MachineRevenueItem {
  machineId: string | null
  machineName: string
  totalRevenue: number
  quoteCount: number
  materialNet: number
  materialGross: number
  materialNetProfit: number
  cuttingNet: number
  cuttingVat: number
  cuttingGross: number
  edgeNet: number
  totalMaterialNet: number
}

interface AverageQuoteMetrics {
  currentAverage: number
  currentMedian: number
  previousAverage: number | null
  delta: number | null
  totalQuotes: number
}

interface LeadTimeMetrics {
  averageDays: number | null
  medianDays: number | null
  p90Days: number | null
  sampleSize: number
}

interface MetricsResponse {
  month?: {
    start?: string
    end?: string
    year: number
    month: number
    iso: string
    label: string
  }
  machineRevenue: MachineRevenueItem[]
  machineTotals?: {
    totalRevenue: number
    materialNet: number
    materialGross: number
    materialNetProfit: number
    cuttingNet: number
    cuttingVat: number
    cuttingGross: number
    edgeNet: number
    totalMaterialNet: number
    quoteCount: number
  }
  averageQuote: AverageQuoteMetrics
  leadTime: LeadTimeMetrics
}

function getISOWeek(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = target.valueOf() - firstThursday.valueOf()
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
}

export default function ReportsClient() {
  const router = useRouter()
  const { hasAccess, loading } = usePagePermission('/reports')
  const [range, setRange] = useState<RangeType>('day')
  const [revenueData, setRevenueData] = useState<RevenueDatum[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  const [toplist, setToplist] = useState<RevenueTopItem[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast.error('Nincs jogosultsága a Riportok oldal megtekintéséhez!', {
        position: 'top-right'
      })
      router.push('/home')
    }
  }, [hasAccess, loading, router])

  useEffect(() => {
    const fetchRevenueData = async () => {
      setIsLoadingData(true)
      setChartError(null)

      try {
        const params = new URLSearchParams({ range })
        if (selectedMonth) {
          params.set('month', selectedMonth)
        }
        const response = await fetch(`/api/reports/revenue?${params.toString()}`)
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error?.error || 'Ismeretlen hiba a riport adatainak lekérésekor')
        }
        const data: RevenueResponse = await response.json()
        setRevenueData(data?.data || [])
        setToplist(data?.toplist || [])
        setAvailableMonths(data?.availableMonths || [])

        if (data?.month) {
          const responseMonth = `${data.month.year}-${String(data.month.month).padStart(2, '0')}`
          setSelectedMonth(prev => prev ?? responseMonth)
        }
      } catch (error) {
        console.error('Error fetching revenue data:', error)
        setChartError(error instanceof Error ? error.message : 'Hiba a riport adatainak lekérésekor')
      } finally {
        setIsLoadingData(false)
      }
    }

    if (hasAccess) {
      fetchRevenueData()
    }
  }, [range, selectedMonth, hasAccess])

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!hasAccess) return
      setMetricsLoading(true)
      setMetricsError(null)

      try {
        const params = new URLSearchParams()
        if (selectedMonth) {
          params.set('month', selectedMonth)
        }

        const response = await fetch(
          `/api/reports/metrics${params.toString() ? `?${params.toString()}` : ''}`
        )

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error?.error || 'Ismeretlen hiba a riport metrikák lekérésekor')
        }

        const data: MetricsResponse = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error('Error fetching reports metrics:', error)
        setMetricsError(error instanceof Error ? error.message : 'Hiba a riport metrikák lekérésekor')
      } finally {
        setMetricsLoading(false)
      }
    }

    fetchMetrics()
  }, [hasAccess, selectedMonth])

  const chartSeries = useMemo(() => {
    return [
      {
        name: 'Bevétel',
        data: revenueData.map(item => ({
          x: item.date,
          y: item.total
        }))
      }
    ]
  }, [revenueData])

  const chartOptions: ApexOptions = useMemo(() => ({
    chart: {
      id: 'reports-revenue-chart',
      type: 'area',
      height: 360,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        format: range === 'day' ? 'yyyy.MM.dd' : range === 'week' ? 'yyyy. \'W\'ww' : 'yyyy.MM'
      }
    },
    yaxis: {
      labels: {
        formatter: value => `${Math.round(value).toLocaleString('hu-HU')} Ft`
      }
    },
    tooltip: {
      x: {
        format: range === 'day' ? 'yyyy.MM.dd' : range === 'week' ? 'yyyy. \'W\'ww' : 'yyyy.MM'
      },
      y: {
        formatter: value => `${Math.round(value).toLocaleString('hu-HU')} Ft`
      }
    }
  }), [range])

  const handleRangeChange = (event: SelectChangeEvent<RangeType>) => {
    setRange(event.target.value as RangeType)
  }

  const handleMonthChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    setSelectedMonth(value === '' ? undefined : value)
  }

  const formatMonthLabel = (monthValue: string) => {
    const [year, month] = monthValue.split('-')
    if (!year || !month) return monthValue
    const date = new Date(Number(year), Number(month) - 1, 1)
    if (Number.isNaN(date.getTime())) return monthValue
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long'
    })
  }

  const formatAxisLabel = (value: number | string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    if (range === 'day') {
      return date.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }

    if (range === 'week') {
      const week = getISOWeek(date)
      return `${date.getUTCFullYear()}. ${String(week).padStart(2, '0')}. hét`
    }

    return `${date.getUTCFullYear()}. ${String(date.getUTCMonth() + 1).padStart(2, '0')}. hó`
  }

  const formatTooltipLabel = (value: number | string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    if (range === 'day') {
      return date.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }

    if (range === 'week') {
      const week = getISOWeek(date)
      return `${date.getUTCFullYear()}. ${String(week).padStart(2, '0')}. hét`
    }

    return `${date.getUTCFullYear()}. ${String(date.getUTCMonth() + 1).padStart(2, '0')}. hó`
  }

  const hasNonZeroData = useMemo(
    () => revenueData.some(item => item.total !== 0),
    [revenueData]
  )

  const metricsMonthLabel = useMemo(() => {
    if (metrics?.month?.label) {
      return metrics.month.label
    }
    if (metrics?.month) {
      const iso = `${metrics.month.year}-${String(metrics.month.month).padStart(2, '0')}`
      return formatMonthLabel(iso)
    }
    if (selectedMonth) {
      return formatMonthLabel(selectedMonth)
    }
    return ''
  }, [metrics, selectedMonth])

  const formatCurrency = (value: number) => `${Math.round(value).toLocaleString('hu-HU')} Ft`
  const formatSignedCurrency = (value: number) => {
    const rounded = Math.round(Math.abs(value))
    const sign = value >= 0 ? '+' : '-'
    return `${sign}${rounded.toLocaleString('hu-HU')} Ft`
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label='breadcrumb' sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline='hover'
          color='inherit'
          href='/home'
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize='small' />
          Főoldal
        </Link>
        <Typography color='text.primary'>Riportok</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <AssessmentIcon color='primary' sx={{ fontSize: 40 }} />
        <Box>
          <Typography variant='h4' component='h1' gutterBottom sx={{ mb: 1 }}>
            Riportok
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Az alábbi grafikon a lezárt (ready) árajánlatok napi, heti vagy havi bevételét mutatja.
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent='space-between' spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant='h6' gutterBottom>
              Bevételi trend (lezárt árajánlatok)
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              A grafikon alapja a <code>ready_at</code> dátummal rendelkező árajánlatok <code>final_total_after_discount</code> értékeinek összege.
            </Typography>
          </Box>
          <Select
            value={range}
            onChange={handleRangeChange}
            size='small'
            sx={{ minWidth: 180 }}
          >
            <MenuItem value='day'>Napi bontás</MenuItem>
            <MenuItem value='week'>Heti bontás</MenuItem>
            <MenuItem value='month'>Havi bontás</MenuItem>
          </Select>
        </Stack>

        {isLoadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
            <CircularProgress />
          </Box>
        ) : chartError ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
            <Typography color='error'>{chartError}</Typography>
          </Box>
        ) : !hasNonZeroData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
            <Typography color='text.secondary'>Nincs adat a megadott időszakra.</Typography>
          </Box>
        ) : (
          <ReactApexChart
            options={{
              ...chartOptions,
              xaxis: {
                ...chartOptions.xaxis,
                labels: {
                  ...(chartOptions.xaxis?.labels || {}),
                  formatter: formatAxisLabel
                }
              },
              tooltip: {
                ...chartOptions.tooltip,
                x: {
                  ...(chartOptions.tooltip?.x || {}),
                  formatter: formatTooltipLabel
                }
              }
            }}
            series={chartSeries}
            type='area'
            height={360}
          />
        )}
      </Paper>

      <Stack spacing={3} sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant='h6' gutterBottom>
            Gép bevétel {metricsMonthLabel && `(${metricsMonthLabel})`}
          </Typography>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 160 }}>
              <CircularProgress />
            </Box>
          ) : metricsError ? (
            <Typography color='error'>{metricsError}</Typography>
          ) : !metrics?.machineRevenue?.length ? (
            <Typography color='text.secondary'>
              Nincs megjeleníthető bevételi adat a kiválasztott hónapra.
            </Typography>
          ) : (
            <TableContainer component={Box} sx={{ borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}` }}>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Gép</TableCell>
                    <TableCell align='right'>Lezárt ajánlatok</TableCell>
                    <TableCell align='right'>Anyag bevétel (nettó)</TableCell>
                    <TableCell align='right'>Anyag haszon (nettó)</TableCell>
                    <TableCell align='right'>Élzárás bevétel (nettó)</TableCell>
                    <TableCell align='right'>Vágási díj (nettó)</TableCell>
                    <TableCell align='right'>Teljes anyag bevétel (nettó)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.machineRevenue.map(item => (
                    <TableRow key={item.machineId || item.machineName}>
                      <TableCell component='th' scope='row'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                          {item.machineName}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>{item.quoteCount}</TableCell>
                      <TableCell align='right'>{formatCurrency(item.materialNet)}</TableCell>
                      <TableCell align='right'>{formatCurrency(item.materialNetProfit)}</TableCell>
                      <TableCell align='right'>{formatCurrency(item.edgeNet)}</TableCell>
                      <TableCell align='right'>{formatCurrency(item.cuttingNet)}</TableCell>
                      <TableCell align='right'>{formatCurrency(item.totalMaterialNet)}</TableCell>
                    </TableRow>
                  ))}
                  {metrics.machineTotals && (
                    <TableRow sx={{ backgroundColor: theme => (theme.palette.mode === 'light' ? 'grey.100' : 'grey.900') }}>
                      <TableCell component='th' scope='row'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          Összesen
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {metrics.machineTotals.quoteCount}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {formatCurrency(metrics.machineTotals.materialNet)}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {formatCurrency(metrics.machineTotals.materialNetProfit)}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {formatCurrency(metrics.machineTotals.edgeNet)}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {formatCurrency(metrics.machineTotals.cuttingNet)}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          {formatCurrency(metrics.machineTotals.totalMaterialNet)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant='h6' gutterBottom>
            Átlagos ajánlat érték {metricsMonthLabel && `(${metricsMonthLabel})`}
          </Typography>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 160 }}>
              <CircularProgress />
            </Box>
          ) : metricsError ? (
            <Typography color='error'>{metricsError}</Typography>
          ) : !metrics?.averageQuote ? (
            <Typography color='text.secondary'>
              Nem áll rendelkezésre adat az átlagos ajánlat értékhez.
            </Typography>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Aktuális átlag
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {formatCurrency(metrics.averageQuote.currentAverage)}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Medián érték
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {formatCurrency(metrics.averageQuote.currentMedian)}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Változás az előző hónaphoz
                </Typography>
                <Typography
                  variant='h6'
                  sx={{
                    fontWeight: 600,
                    color:
                      metrics.averageQuote.delta !== null
                        ? metrics.averageQuote.delta >= 0
                          ? 'success.main'
                          : 'error.main'
                        : 'text.primary'
                  }}
                >
                  {metrics.averageQuote.delta !== null
                    ? formatSignedCurrency(metrics.averageQuote.delta)
                    : 'N/A'}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {metrics.averageQuote.previousAverage !== null
                    ? `Előző hónap átlaga: ${formatCurrency(metrics.averageQuote.previousAverage)}`
                    : 'Nincs adat az előző hónapra'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Lezárt ajánlatok száma
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {metrics.averageQuote.totalQuotes}
                </Typography>
              </Box>
            </Stack>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant='h6' gutterBottom>
            Átfutási idő {metricsMonthLabel && `(${metricsMonthLabel})`}
          </Typography>
          {metricsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 160 }}>
              <CircularProgress />
            </Box>
          ) : metricsError ? (
            <Typography color='error'>{metricsError}</Typography>
          ) : !metrics?.leadTime || metrics.leadTime.sampleSize === 0 ? (
            <Typography color='text.secondary'>
              Nem áll rendelkezésre elegendő adat az átfutási idő kiszámításához.
            </Typography>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Átlagos átfutási idő
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {metrics.leadTime.averageDays !== null ? `${metrics.leadTime.averageDays} nap` : 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Medián átfutási idő
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {metrics.leadTime.medianDays !== null ? `${metrics.leadTime.medianDays} nap` : 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  90. percentilis
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {metrics.leadTime.p90Days !== null ? `${metrics.leadTime.p90Days} nap` : 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Mintanagyság
                </Typography>
                <Typography variant='h5' sx={{ fontWeight: 700 }}>
                  {metrics.leadTime.sampleSize}
                </Typography>
              </Box>
            </Stack>
          )}
        </Paper>
      </Stack>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent='space-between'
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant='h6' gutterBottom>
              Top 10 ügyfél ({selectedMonth ? formatMonthLabel(selectedMonth) : 'aktuális hónap'})
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              A listában csak azok az ügyfelek szerepelnek, akiknek az adott hónapban van lezárt (ready) árajánlatuk.
            </Typography>
          </Box>
          <Select
            value={selectedMonth ?? ''}
            onChange={handleMonthChange}
            size='small'
            sx={{ minWidth: 200 }}
            displayEmpty
          >
            <MenuItem value=''>
              <em>Aktuális hónap</em>
            </MenuItem>
            {availableMonths.map(monthValue => (
              <MenuItem key={monthValue} value={monthValue}>
                {formatMonthLabel(monthValue)}
              </MenuItem>
            ))}
          </Select>
        </Stack>
        {isLoadingData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : toplist.length === 0 ? (
          <Typography color='text.secondary'>
            A választott hónapban nincs megjeleníthető lezárt árajánlat.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {toplist.map((item, index) => (
              <Box
                key={item.customer_id || item.customer_name || index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                  borderRadius: 1,
                  px: 2,
                  py: 1.5
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant='subtitle2' sx={{ minWidth: 32 }}>
                    #{index + 1}
                  </Typography>
                  <Typography variant='body1'>
                    {item.customer_name || 'Ismeretlen ügyfél'}
                  </Typography>
                </Box>
                <Typography variant='subtitle1' fontWeight={600}>
                  {Math.round(item.total).toLocaleString('hu-HU')} Ft
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  )
}


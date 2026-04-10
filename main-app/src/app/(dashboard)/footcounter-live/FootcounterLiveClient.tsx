'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

import type { FootcounterDashboardStats } from '@/types/footcounter'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const HEATMAP_WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function formatAvg(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n >= 10 ? Math.round(n).toLocaleString('hu-HU') : n.toFixed(1)
}

function pctVsAvg(today: number, avg: number): string | null {
  if (avg <= 0 || !Number.isFinite(avg)) return null
  const p = Math.round((today / avg - 1) * 100)
  if (p === 0) return '≈ átlag'
  return p > 0 ? `+${p}% az átlaghoz` : `${p}% az átlaghoz`
}

/**
 * Bejárat élő: Supabase stats + optional LAN MJPEG.
 */
export default function FootcounterLiveClient() {
  const streamUrl = useMemo(() => {
    const direct = process.env.NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL?.trim()
    if (direct) return direct
    return '/api/footcounter/stream'
  }, [])

  const [stats, setStats] = useState<FootcounterDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [livePreviewOpen, setLivePreviewOpen] = useState(false)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await fetch('/api/footcounter/stats', { credentials: 'include' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || res.statusText)
      }
      const data = (await res.json()) as FootcounterDashboardStats
      setStats(data)
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Ismeretlen hiba')
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void loadStats()
      }
    }, 30_000)
    return () => window.clearInterval(id)
  }, [loadStats])

  const chartOptions = useMemo(() => {
    const series = stats?.series_7d ?? []
    const categories = series.map(s => s.day)
    return {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: { categories },
      yaxis: { title: { text: 'Események' } },
      fill: { opacity: 1 },
      colors: ['#16A085', '#E67E22'],
      legend: { position: 'top' as const },
      tooltip: { y: { formatter: (val: number) => `${val}` } }
    }
  }, [stats?.series_7d])

  const chartSeries = useMemo(() => {
    const series = stats?.series_7d ?? []
    return [
      { name: 'Be', data: series.map(s => s.in_count) },
      { name: 'Ki', data: series.map(s => s.out_count) }
    ]
  }, [stats?.series_7d])

  const hourlyOptions = useMemo(() => {
    const hourly = stats?.series_today_hourly ?? []
    return {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 2 } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      xaxis: { categories: hourly.map(h => `${h.hour}`), title: { text: 'Óra (Budapest)' } },
      yaxis: { title: { text: 'Események' } },
      fill: { opacity: 1 },
      colors: ['#16A085', '#E67E22'],
      legend: { position: 'top' as const },
      tooltip: { y: { formatter: (val: number) => `${val}` } }
    }
  }, [stats?.series_today_hourly])

  const hourlySeries = useMemo(() => {
    const hourly = stats?.series_today_hourly ?? []
    return [
      { name: 'Be', data: hourly.map(h => h.in_count) },
      { name: 'Ki', data: hourly.map(h => h.out_count) }
    ]
  }, [stats?.series_today_hourly])

  const heatmapOptions = useMemo(() => {
    const flat = stats?.heatmap_in.matrix.flat() ?? []
    const maxVal = Math.max(1, ...flat)
    return {
      chart: { type: 'heatmap' as const, toolbar: { show: false }, fontFamily: 'inherit' },
      dataLabels: { enabled: false },
      colors: ['#00897B'],
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.55,
          radius: 2,
          colorScale: {
            ranges: [
              { from: 0, to: 0, color: '#ECEFF1', name: '0' },
              { from: 1, to: maxVal, color: '#00897B', name: 'be' }
            ]
          }
        }
      },
      xaxis: {
        type: 'category' as const,
        categories: Array.from({ length: 24 }, (_, i) => `${i}`),
        title: { text: 'Óra' }
      },
      yaxis: { show: true },
      tooltip: { y: { formatter: (val: number) => `${val} be` } }
    }
  }, [stats?.heatmap_in.matrix])

  const heatmapSeries = useMemo(() => {
    const m = stats?.heatmap_in.matrix ?? []
    return HEATMAP_WEEKDAY_LABELS.map((name, wd) => ({
      name,
      data: m[wd] ?? Array.from({ length: 24 }, () => 0)
    }))
  }, [stats?.heatmap_in.matrix])

  const sameWeekdayBeVsAvg = useMemo(() => {
    const sw = stats?.same_weekday_avg
    if (!sw) return null
    return pctVsAvg(stats.today_in, sw.avg_in)
  }, [stats?.same_weekday_avg, stats?.today_in])

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction='row' justifyContent='space-between' alignItems='flex-start' sx={{ mb: 2 }} flexWrap='wrap' gap={2}>
        <Box>
          <Typography variant='h4' sx={{ mb: 1 }}>
            Bejárat élő
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            A számok a Supabase-ben tárolt szinkron eseményekből jönnek — nem nullázódnak, ha a Pi újraindul. Az élő
            képen látható számláló a Pi aktuális munkamenetét mutatja. Frissítés 30 másodpercenként.
          </Typography>
        </Box>
        <Button variant='outlined' size='small' onClick={() => loadStats()} disabled={statsLoading}>
          Adatok frissítése
        </Button>
      </Stack>

      {statsLoading && !stats && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {statsError && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {statsError}
        </Alert>
      )}

      {stats && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, border: t => `1px solid ${t.palette.divider}` }}>
                <Typography variant='caption' color='text.secondary'>
                  Összesen (szinkron) — Be
                </Typography>
                <Stack direction='row' alignItems='center' spacing={1} sx={{ mt: 0.5 }}>
                  <TrendingUpIcon color='success' />
                  <Typography variant='h4'>{stats.total_in}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, border: t => `1px solid ${t.palette.divider}` }}>
                <Typography variant='caption' color='text.secondary'>
                  Összesen (szinkron) — Ki
                </Typography>
                <Stack direction='row' alignItems='center' spacing={1} sx={{ mt: 0.5 }}>
                  <TrendingDownIcon color='warning' />
                  <Typography variant='h4'>{stats.total_out}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, border: t => `1px solid ${t.palette.divider}` }}>
                <Typography variant='caption' color='text.secondary'>
                  Ma (Budapest) — Be / Ki
                </Typography>
                <Typography variant='h4' sx={{ mt: 0.5 }}>
                  {stats.today_in} / {stats.today_out}
                </Typography>
                {stats.same_weekday_avg && (
                  <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap sx={{ mt: 1 }}>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ width: '100%' }}>
                      Átlag ugyanezen a hétköznapon ({stats.same_weekday_avg.sample_days} nap,{' '}
                      {stats.same_weekday_avg.lookback_days} napos ablak):
                    </Typography>
                    <Typography variant='body2'>
                      Be {formatAvg(stats.same_weekday_avg.avg_in)} · Ki{' '}
                      {formatAvg(stats.same_weekday_avg.avg_out)}
                    </Typography>
                    {sameWeekdayBeVsAvg && (
                      <Chip
                        size='small'
                        label={`Be: ${sameWeekdayBeVsAvg}`}
                        variant='outlined'
                        sx={{ height: 22 }}
                      />
                    )}
                  </Stack>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, border: t => `1px solid ${t.palette.divider}` }}>
                <Typography variant='caption' color='text.secondary'>
                  Utolsó esemény
                </Typography>
                <Typography variant='body1' sx={{ mt: 0.5 }}>
                  {stats.last_event_at
                    ? new Date(stats.last_event_at).toLocaleString('hu-HU')
                    : '—'}
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                  Eszköz utolsó jelzés:{' '}
                  {stats.device_last_seen
                    ? new Date(stats.device_last_seen).toLocaleString('hu-HU')
                    : '—'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mb: 3, border: t => `1px solid ${t.palette.divider}` }}>
            <Typography variant='subtitle1' sx={{ mb: 0.5 }}>
              Ma óránként (Europe/Budapest)
            </Typography>
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 2 }}>
              Be és Ki események óránként a mai naptól.
            </Typography>
            <Box sx={{ minHeight: 300 }}>
              <ReactApexChart options={hourlyOptions} series={hourlySeries} type='bar' height={300} />
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 3, border: t => `1px solid ${t.palette.divider}` }}>
            <Typography variant='subtitle1' sx={{ mb: 0.5 }}>
              Be forgalom: hét napja × óra
            </Typography>
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 2 }}>
              Csak bejárat (Be), utolsó {stats.heatmap_in.days} nap összesen — hol zsúfolt a bolt tipikusan.
            </Typography>
            <Box sx={{ minHeight: 380, overflowX: 'auto' }}>
              <ReactApexChart options={heatmapOptions} series={heatmapSeries} type='heatmap' height={380} />
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 3, border: t => `1px solid ${t.palette.divider}` }}>
            <Typography variant='subtitle1' sx={{ mb: 2 }}>
              Utolsó 7 nap (Europe/Budapest)
            </Typography>
            {stats.series_7d.length === 0 ? (
              <Typography color='text.secondary'>Még nincs szinkronizált esemény.</Typography>
            ) : (
              <Box sx={{ minHeight: 320 }}>
                <ReactApexChart options={chartOptions} series={chartSeries} type='bar' height={320} />
              </Box>
            )}
          </Paper>
        </>
      )}

      <Accordion
        expanded={livePreviewOpen}
        onChange={(_, expanded) => setLivePreviewOpen(expanded)}
        disableGutters
        elevation={0}
        sx={{
          mt: 2,
          border: t => `1px solid ${t.palette.divider}`,
          borderRadius: 1,
          '&:before': { display: 'none' },
          overflow: 'hidden'
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 1 } }}>
          <Typography variant='subtitle2'>Élő kép (opcionális)</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1, pb: 1 }}>
          {livePreviewOpen ? (
            <Paper
              elevation={0}
              sx={{
                border: theme => `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: { xs: 'min(32vh, 280px)', sm: 'min(36vh, 320px)' }
              }}
            >
              <Box
                component='img'
                src={streamUrl}
                alt='Bejárat élő közvetítés'
                sx={{
                  display: 'block',
                  width: '100%',
                  maxHeight: { xs: 'min(32vh, 280px)', sm: 'min(36vh, 320px)' },
                  height: 'auto',
                  objectFit: 'contain',
                  verticalAlign: 'bottom'
                }}
              />
            </Paper>
          ) : null}
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}

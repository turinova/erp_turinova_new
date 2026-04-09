'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

import type { FootcounterDashboardStats } from '@/types/footcounter'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ?? ''
/** Vercel production/preview: build sets this via next.config `env` (VERCEL_ENV). */
const isVercelCloudDeploy = vercelEnv === 'production' || vercelEnv === 'preview'

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
  const [streamError, setStreamError] = useState<string | null>(null)

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

      {isVercelCloudDeploy && !process.env.NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL?.trim() && (
        <Alert severity='warning' sx={{ mb: 2 }}>
          <Typography variant='body2' component='span' display='block' sx={{ mb: 1 }}>
            <strong>Vercel (production / preview):</strong> a felhőben futó szerver nem éri el a boltban lévő Pi
            LAN-címét (pl. <code>192.168.…</code>). Ezért a szerveres MJPEG-proxy (
            <code>/api/footcounter/stream</code> + <code>FOOTCOUNTER_MJPEG_URL</code>) itt általában{' '}
            <strong>nem működik</strong>.
          </Typography>
          <Typography variant='body2' component='span' display='block' sx={{ mb: 1 }}>
            <strong>Helyi fejlesztés:</strong> <code>http://localhost:3000/footcounter-live</code> — ha a géped
            eléri a Pi MJPEG URL-jét, a kép működhet.
          </Typography>
          <Typography variant='body2' component='span' display='block'>
            <strong>Éles kép a felhőből:</strong> állíts be <code>NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL</code>-t
            (HTTPS, pl. tunnel a Pi felé), vagy használd csak a szinkron számokat és a grafikont — ezek Supabase-ből
            jönnek, Pi szinkronnal töltődnek.
          </Typography>
        </Alert>
      )}
      {isVercelCloudDeploy && !!process.env.NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL?.trim() && (
        <Alert severity='info' sx={{ mb: 2 }}>
          Vercel: az élő kép a <code>NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL</code> miatt közvetlenül a böngészőből tölt.
          A Be/Ki statisztikák továbbra is a Supabase szinkronból származnak.
        </Alert>
      )}

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

      <Typography variant='subtitle1' sx={{ mb: 1, mt: 2 }}>
        Élő kép (opcionális)
      </Typography>
      {process.env.NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL ? (
        <Alert severity='info' sx={{ mb: 2 }}>
          Közvetlen stream URL van beállítva.
        </Alert>
      ) : (
        <Alert severity='info' sx={{ mb: 2 }}>
          Szerveres proxy: <code>FOOTCOUNTER_MJPEG_URL</code>. Ha nincs beállítva, a kép hibás lehet; az adatok
          ettől függetlenül működnek.
        </Alert>
      )}
      {streamError && (
        <Alert severity='warning' sx={{ mb: 2 }}>
          {streamError}
        </Alert>
      )}
      <Paper
        elevation={0}
        sx={{
          border: theme => `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          minHeight: 200
        }}
      >
        <Box
          component='img'
          src={streamUrl}
          alt='Bejárat élő közvetítés'
          sx={{
            display: 'block',
            width: '100%',
            height: 'auto',
            verticalAlign: 'bottom'
          }}
          onError={() =>
            setStreamError(
              'A kép nem töltődik be. LAN / FOOTCOUNTER_MJPEG_URL ellenőrzése (Vercel-en nem működik a 192.168… cím).'
            )
          }
          onLoad={() => setStreamError(null)}
        />
      </Paper>
    </Box>
  )
}

'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'

import CustomTabList from '@core/components/mui/TabList'
import FootcounterChartCard from '@/components/footcounter/FootcounterChartCard'
import FootcounterHeroCard from '@/components/footcounter/FootcounterHeroCard'
import FootcounterInsightBullets from '@/components/footcounter/FootcounterInsightBullets'
import FootcounterKpiCard from '@/components/footcounter/FootcounterKpiCard'
import FootcounterMonthHero from '@/components/footcounter/FootcounterMonthHero'
import FootcounterMonthToolbar from '@/components/footcounter/FootcounterMonthToolbar'
import FootcounterWeatherImpact from '@/components/footcounter/FootcounterWeatherImpact'
import { useFootcounterCharts } from '@/components/footcounter/useFootcounterCharts'
import { formatAvg, formatMonthKeyLabel } from '@/lib/footcounter-format'
import { computeMonthInsightBullets } from '@/lib/footcounter-insights-copy'
import { computeTrafficByWeatherBucket } from '@/lib/footcounter-weather-impact'
import {
  FOOTCOUNTER_LOCAL_TZ,
  FOOTCOUNTER_WEATHER_PLACE,
  summarizeMonthWeatherImpacts
} from '@/lib/footcounter-weather'
import type { FootcounterDashboardStats } from '@/types/footcounter'

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <CircularProgress size={28} />
})

type TabValue = 'today' | 'month' | 'patterns'

export default function FootcounterLiveClient() {
  const streamUrl = useMemo(() => {
    const direct = process.env.NEXT_PUBLIC_FOOTCOUNTER_STREAM_URL?.trim()
    if (direct) return direct
    return '/api/footcounter/stream'
  }, [])

  const [activeTab, setActiveTab] = useState<TabValue>('month')
  const [stats, setStats] = useState<FootcounterDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [weatherSyncing, setWeatherSyncing] = useState(false)
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null)
  const [hoursMode, setHoursMode] = useState<'open' | 'all'>('open')
  const [yearChartExpanded, setYearChartExpanded] = useState(false)
  const [liveCameraExpanded, setLiveCameraExpanded] = useState(false)
  const [monthKey, setMonthKey] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FOOTCOUNTER_LOCAL_TZ,
      year: 'numeric',
      month: '2-digit'
    }).format(new Date())
  )

  const monthOptions = useMemo(() => {
    const base = new Date()
    const fmtKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: FOOTCOUNTER_LOCAL_TZ,
      year: 'numeric',
      month: '2-digit'
    })
    const fmtLabel = new Intl.DateTimeFormat('hu-HU', {
      timeZone: FOOTCOUNTER_LOCAL_TZ,
      year: 'numeric',
      month: 'long'
    })
    const out: Array<{ key: string; label: string }> = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(base)
      d.setMonth(base.getMonth() - i)
      const key = fmtKey.format(d)
      const label = fmtLabel.format(d)
      if (!out.some(x => x.key === key)) out.push({ key, label })
    }
    return out
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await fetch(`/api/footcounter/stats?hours=${hoursMode}&month=${encodeURIComponent(monthKey)}`, {
        credentials: 'include'
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || res.statusText)
      }
      setStats((await res.json()) as FootcounterDashboardStats)
      setLastUpdatedAt(new Date())
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Ismeretlen hiba')
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [hoursMode, monthKey])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const syncWeather = useCallback(async () => {
    setWeatherSyncing(true)
    setWeatherMessage(null)
    try {
      const res = await fetch('/api/footcounter/weather?days=90', { method: 'POST', credentials: 'include' })
      const j = (await res.json().catch(() => ({}))) as { error?: string; upserted?: number }
      if (!res.ok) throw new Error(j.error || res.statusText)
      setWeatherMessage(`${j.upserted ?? 0} nap időjárás frissítve (${FOOTCOUNTER_WEATHER_PLACE})`)
      await loadStats()
    } catch (e) {
      setWeatherMessage(e instanceof Error ? e.message : 'Időjárás szinkron hiba')
    } finally {
      setWeatherSyncing(false)
    }
  }, [loadStats])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadStats()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [loadStats])

  const openHourRangeToday = useMemo(() => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: FOOTCOUNTER_LOCAL_TZ, weekday: 'short' }).format(new Date())
    if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(wd)) return { start: 8, end: 17 }
    if (wd === 'Sat') return { start: 8, end: 12 }
    return { start: 0, end: -1 }
  }, [])

  const hourlyFiltered = useMemo(() => {
    const hourly = stats?.series_today_hourly ?? []
    if (hoursMode === 'all') return hourly
    if (openHourRangeToday.end < openHourRangeToday.start) return []
    return hourly.filter(h => h.hour >= openHourRangeToday.start && h.hour <= openHourRangeToday.end)
  }, [stats?.series_today_hourly, hoursMode, openHourRangeToday])

  const hasMonthWeather = useMemo(
    () => (stats?.month_weather ?? []).some(w => w.condition !== 'unknown'),
    [stats?.month_weather]
  )

  const weatherTrafficImpact = useMemo(
    () => computeTrafficByWeatherBucket(stats?.series_month ?? [], stats?.month_weather ?? []),
    [stats?.series_month, stats?.month_weather]
  )

  const monthInsightBullets = useMemo(() => {
    if (!stats) return []
    return computeMonthInsightBullets(stats, weatherTrafficImpact)
  }, [stats, weatherTrafficImpact])

  const monthWeatherImpact = useMemo(
    () => summarizeMonthWeatherImpacts(stats?.month_weather ?? []),
    [stats?.month_weather]
  )

  const handleYearMonthSelect = useCallback((key: string) => {
    if (/^[0-9]{4}-[0-9]{2}$/.test(key)) setMonthKey(key)
  }, [])

  const charts = useFootcounterCharts(stats, hoursMode, hourlyFiltered, {
    onYearMonthSelect: handleYearMonthSelect,
    selectedMonthKey: monthKey
  })

  const monthLabel = monthOptions.find(m => m.key === monthKey)?.label ?? monthKey

  const yearRangeLabel = useMemo(() => {
    const months = stats?.series_months_12 ?? []
    if (months.length === 0) return null
    const first = months[0]?.month_key
    const last = months[months.length - 1]?.month_key
    if (!first || !last) return null
    return `${formatMonthKeyLabel(first)} – ${formatMonthKeyLabel(last)}`
  }, [stats?.series_months_12])

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100%' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant='h4' sx={{ fontWeight: 700, mb: 0.5 }}>
            Bejárat
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {FOOTCOUNTER_WEATHER_PLACE} · számláló adatok · frissül 30 másodpercenként
          </Typography>
        </Box>
        <Tooltip title='Nyitvatartási órák (8–17 hétköznap, szombat 8–12) vagy teljes nap'>
          <ToggleButtonGroup
            size='small'
            exclusive
            value={hoursMode}
            onChange={(_, v) => {
              if (v === 'open' || v === 'all') setHoursMode(v)
            }}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            <ToggleButton value='open'>Nyitvatartás</ToggleButton>
            <ToggleButton value='all'>Összes óra</ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      {statsLoading && !stats && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {statsError && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {statsError}
        </Alert>
      )}

      {weatherMessage && (
        <Alert severity='info' sx={{ mb: 2 }} onClose={() => setWeatherMessage(null)}>
          {weatherMessage}
        </Alert>
      )}

      {stats && (
        <TabContext value={activeTab}>
          <CustomTabList
            pill='true'
            color='success'
            onChange={(_, v) => setActiveTab(v as TabValue)}
            aria-label='Bejárat nézetek'
            sx={{ mb: 2 }}
          >
            <Tab value='today' label='Ma' />
            <Tab value='month' label='Hónap' />
            <Tab value='patterns' label='Beosztás' />
          </CustomTabList>

          {/* —— MA —— */}
          <TabPanel value='today' sx={{ p: 0 }}>
            <FootcounterHeroCard stats={stats} />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
                mb: 2
              }}
            >
              <FootcounterKpiCard
                label='Ma be / ki'
                value={`${stats.today_in} / ${stats.today_out}`}
                sub={
                  stats.same_weekday_avg
                    ? `Átlag ezen a napon: ${formatAvg(stats.same_weekday_avg.avg_in)} be`
                    : undefined
                }
              />
              <FootcounterKpiCard
                label='Bent lévők (becslés)'
                value={`~${stats.live_occupancy ?? 0}`}
                sub={`${stats.today_in} be − ${stats.today_out} ki`}
                highlight
              />
              <FootcounterKpiCard
                label='Mai csúcsóra'
                value={stats.today_peak_hour != null ? `${stats.today_peak_hour}:00` : '—'}
                sub={`${stats.today_peak_in ?? 0} belépő ebben az órában`}
              />
              <FootcounterKpiCard
                label='Számláló összesen'
                value={stats.total_in.toLocaleString('hu-HU')}
                sub={`Összes kilépő: ${stats.total_out.toLocaleString('hu-HU')} · életciklus`}
              />
            </Box>

            <FootcounterChartCard
              title={`Ma óránként · ${FOOTCOUNTER_WEATHER_PLACE}`}
              subtitle='Belépő és kilépő események óránként.'
              borderColor='success'
              loading={statsLoading}
              minHeight={300}
            >
              {hourlyFiltered.length === 0 ? (
                <Typography color='text.secondary'>Ma nincs nyitvatartási adat ebben a nézetben.</Typography>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <ReactApexChart options={charts.hourlyOptions} series={charts.hourlySeries} type='bar' height={300} />
                </Box>
              )}
            </FootcounterChartCard>
          </TabPanel>

          {/* —— HÓNAP —— */}
          <TabPanel value='month' sx={{ p: 0 }}>
            <FootcounterMonthToolbar
              monthKey={monthKey}
              monthOptions={monthOptions}
              onMonthKeyChange={setMonthKey}
              onRefresh={() => void loadStats()}
              onWeatherSync={() => void syncWeather()}
              statsLoading={statsLoading}
              weatherSyncing={weatherSyncing}
              lastUpdatedAt={lastUpdatedAt}
            />

            <FootcounterMonthHero stats={stats} monthLabel={monthLabel} inSum={charts.monthTotals.inSum} />

            <FootcounterInsightBullets bullets={monthInsightBullets} />

            {hasMonthWeather ? (
              <FootcounterWeatherImpact
                impact={weatherTrafficImpact}
                monthLabel={monthLabel}
                avgTempMaxC={monthWeatherImpact.avg_temp_max_c}
              />
            ) : (
              <Alert severity='info' sx={{ mb: 2 }}>
                Az időjárás összevetéshez futtasd az <strong>Időjárás szinkron</strong> gombot (Open-Meteo,{' '}
                {FOOTCOUNTER_WEATHER_PLACE}).
              </Alert>
            )}

            <FootcounterChartCard
              title={`Napi forgalom · ${monthLabel}`}
              subtitle='Belépő és kilépő naponta — az időjárás a tooltipben látható.'
              borderColor='success'
              loading={statsLoading}
              minHeight={360}
            >
              {stats.series_month.length === 0 ? (
                <Typography color='text.secondary'>Nincs adat ebben a hónapban.</Typography>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <ReactApexChart
                    options={charts.monthTrafficOptions}
                    series={charts.monthTrafficSeries}
                    type='line'
                    height={360}
                  />
                </Box>
              )}
            </FootcounterChartCard>

            <Accordion
              expanded={yearChartExpanded}
              onChange={(_, exp) => setYearChartExpanded(exp)}
              disableGutters
              elevation={0}
              sx={{
                mt: 2,
                border: t => `1px solid ${t.palette.divider}`,
                borderRadius: 1,
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    Éves szezonalitás
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {yearRangeLabel
                      ? `Utolsó 12 hónap · ${yearRangeLabel} · kattints egy oszlopra a hónap kiválasztásához`
                      : 'Utolsó 12 hónap összesített havi forgalom'}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {(stats.series_months_12?.length ?? 0) === 0 ? (
                  <Typography color='text.secondary'>Nincs elég havi adat a szezonalitáshoz.</Typography>
                ) : (
                  <Box sx={{ width: '100%' }}>
                    <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mb: 2 }}>
                      <Chip
                        label={`12 hó be: ${charts.yearTotals.inSum.toLocaleString('hu-HU')}`}
                        variant='outlined'
                        color='success'
                        size='small'
                      />
                      <Chip
                        label={`12 hó ki: ${charts.yearTotals.outSum.toLocaleString('hu-HU')}`}
                        variant='outlined'
                        color='warning'
                        size='small'
                      />
                      <Chip
                        label={`Átlag / hó: ${formatAvg(charts.yearTotals.inSum / 12)} be`}
                        variant='outlined'
                        size='small'
                      />
                      <Chip label={`Kiválasztva: ${monthLabel}`} color='success' variant='filled' size='small' />
                    </Stack>
                    <ReactApexChart
                      options={charts.yearSeasonOptions}
                      series={charts.yearSeasonSeries}
                      type='bar'
                      height={300}
                    />
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </TabPanel>

          {/* —— BEOSZTÁS —— */}
          <TabPanel value='patterns' sx={{ p: 0 }}>
            <FootcounterChartCard
              title='Mikor zsúfolt a bolt?'
              subtitle={`Belépők hét × óra mátrix, utolsó ${stats.heatmap_in.days} nap — nyitvatartási órák.`}
              borderColor='primary'
              loading={statsLoading}
              minHeight={360}
            >
              <Box sx={{ overflowX: 'auto', width: '100%' }}>
                <ReactApexChart options={charts.heatmapOptions} series={charts.heatmapSeries} type='heatmap' height={360} />
              </Box>
            </FootcounterChartCard>

            {(stats.weekday_profile?.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <FootcounterChartCard
                  title='Hét napja szerinti átlag'
                  subtitle='Átlagos belépő / nap, utolsó 90 nap.'
                  borderColor='info'
                  loading={statsLoading}
                  minHeight={280}
                >
                  <Box sx={{ width: '100%' }}>
                    <ReactApexChart
                      options={charts.weekdayChartOptions}
                      series={charts.weekdayChartSeries}
                      type='bar'
                      height={280}
                    />
                  </Box>
                </FootcounterChartCard>
              </Box>
            )}

            <Accordion
              expanded={liveCameraExpanded}
              onChange={(_, exp) => setLiveCameraExpanded(exp)}
              disableGutters
              elevation={0}
              sx={{
                mt: 2,
                border: t => `1px solid ${t.palette.divider}`,
                borderRadius: 1,
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction='row' alignItems='center' spacing={1}>
                  <VideocamOutlinedIcon fontSize='small' color='action' />
                  <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                    Élő kamera
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box
                  sx={{
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                    maxHeight: { xs: 280, sm: 360 }
                  }}
                >
                  <Box
                    component='img'
                    src={streamUrl}
                    alt='Bejárat élő kép'
                    sx={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </TabPanel>
        </TabContext>
      )}
    </Box>
  )
}

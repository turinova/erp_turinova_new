'use client'

import { useMemo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'

import type { FootcounterDashboardStats } from '@/types/footcounter'
import { formatAvg, formatMonthKeyLabel } from '@/lib/footcounter-format'
import { formatWeatherDetailHu, FOOTCOUNTER_WEATHER_PLACE } from '@/lib/footcounter-weather'
import { weatherDayIcon } from '@/lib/footcounter-weather-impact'

const HEATMAP_WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

type HoursMode = 'open' | 'all'

function dayLabel(day: string | null | undefined): string {
  if (!day) return '?'
  return day.length >= 10 ? day.slice(8) : day
}

function heatmapHourLabels(start: number, end: number): string[] {
  return Array.from({ length: end - start + 1 }, (_, i) => `${start + i}`)
}

export function useFootcounterCharts(
  stats: FootcounterDashboardStats | null,
  hoursMode: HoursMode,
  hourlyFiltered: FootcounterDashboardStats['series_today_hourly'],
  chartOpts?: { onYearMonthSelect?: (monthKey: string) => void; selectedMonthKey?: string }
) {
  const theme = useTheme()

  const chartColors = useMemo(
    () => ({
      in: theme.palette.success.main,
      out: theme.palette.warning.main,
      // ApexCharts cannot parse MUI CSS-var colors (text.primary, divider, etc.)
      total: theme.palette.secondary.main,
      tempMax: theme.palette.error.light,
      tempMin: theme.palette.info.main,
      accent: theme.palette.success.main
    }),
    [theme]
  )

  const monthTotals = useMemo(() => {
    const series = stats?.series_month ?? []
    let inSum = 0
    let outSum = 0
    for (const d of series) {
      inSum += d.in_count
      outSum += d.out_count
    }
    return { inSum, outSum, total: inSum + outSum }
  }, [stats?.series_month])

  const monthTrafficOptions = useMemo(() => {
    const series = stats?.series_month ?? []
    const weatherByDay = new Map((stats?.month_weather ?? []).map(w => [w.day, w]))
    return {
      chart: {
        type: 'line' as const,
        toolbar: { show: false },
        fontFamily: theme.typography.fontFamily
      },
      dataLabels: { enabled: false },
      plotOptions: { bar: { horizontal: false, columnWidth: '65%', borderRadius: 3 } },
      stroke: { curve: 'straight' as const, width: [0, 0, 2] },
      xaxis: {
        categories: series.map(s => dayLabel(s.day)),
        title: { text: `Nap (${FOOTCOUNTER_WEATHER_PLACE})` },
        labels: { rotate: -45, style: { fontSize: '10px' } }
      },
      yaxis: [{ title: { text: 'Események' } }],
      colors: [chartColors.in, chartColors.out, chartColors.total],
      legend: { position: 'top' as const },
      tooltip: {
        shared: true,
        intersect: false,
        theme: theme.palette.mode,
        custom: ({
          dataPointIndex,
          w
        }: {
          dataPointIndex: number
          w: { globals: { series: number[][]; seriesNames: string[] } }
        }) => {
          const row = series[dataPointIndex]
          if (!row) return ''
          const weather = weatherByDay.get(row.day)
          const names = w.globals.seriesNames
          const vals = w.globals.series.map(s => s[dataPointIndex] ?? 0)
          const lines = names.map((name, i) => `<div><strong>${name}:</strong> ${vals[i]}</div>`).join('')
          const icon = weather ? weatherDayIcon(weather) : ''
          const weatherLine = weather
            ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(128,128,128,.3);font-size:12px;color:inherit">${icon ? `${icon} ` : ''}${formatWeatherDetailHu(weather)}</div>`
            : ''
          return `<div class="apexcharts-tooltip-custom" style="padding:8px 10px"><div style="font-weight:700;margin-bottom:4px">${row.day.slice(5)}</div>${lines}${weatherLine}</div>`
        }
      },
      grid: { strokeDashArray: 3 },
      markers: { size: 0 },
      fill: { opacity: 1 }
    }
  }, [stats?.series_month, stats?.month_weather, theme, chartColors])

  const monthTrafficSeries = useMemo(() => {
    const series = stats?.series_month ?? []
    return [
      { name: 'Be', type: 'column' as const, data: series.map(s => Number(s.in_count) || 0) },
      { name: 'Ki', type: 'column' as const, data: series.map(s => Number(s.out_count) || 0) },
      {
        name: 'Összesen',
        type: 'line' as const,
        data: series.map(s => (Number(s.in_count) || 0) + (Number(s.out_count) || 0))
      }
    ]
  }, [stats?.series_month])

  const hourlyOptions = useMemo(() => {
    return {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: theme.typography.fontFamily },
      plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      xaxis: { categories: hourlyFiltered.map(h => `${h.hour}`), title: { text: 'Óra' } },
      yaxis: { title: { text: 'Események' } },
      colors: [chartColors.in, chartColors.out],
      legend: { position: 'top' as const },
      tooltip: { theme: theme.palette.mode, y: { formatter: (val: number) => `${val}` } },
      grid: { strokeDashArray: 3 }
    }
  }, [hourlyFiltered, theme, chartColors])

  const hourlySeries = useMemo(
    () => [
      { name: 'Be', data: hourlyFiltered.map(h => h.in_count) },
      { name: 'Ki', data: hourlyFiltered.map(h => h.out_count) }
    ],
    [hourlyFiltered]
  )

  const heatmapOptions = useMemo(() => {
    const heatmapHoursStart = 8
    const heatmapHoursEnd = hoursMode === 'all' ? 23 : 17
    const hourLabels = heatmapHourLabels(heatmapHoursStart, heatmapHoursEnd)
    const matrix = stats?.heatmap_in?.matrix ?? []
    const flat = matrix.flatMap(row =>
      Array.isArray(row) ? row.slice(heatmapHoursStart, heatmapHoursEnd + 1) : []
    )
    const maxVal = Math.max(1, ...flat)
    const emptyColor =
      theme.palette.mode === 'dark' ? alpha(theme.palette.secondary.main, 0.25) : '#ECEFF1'
    return {
      chart: { type: 'heatmap' as const, toolbar: { show: false }, fontFamily: theme.typography.fontFamily },
      dataLabels: { enabled: false },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.55,
          radius: 2,
          colorScale: {
            ranges: [
              { from: 0, to: 0, color: emptyColor, name: '0' },
              { from: 1, to: maxVal, color: chartColors.accent, name: 'be' }
            ]
          }
        }
      },
      xaxis: {
        type: 'category' as const,
        categories: hourLabels,
        title: { text: 'Óra' }
      },
      tooltip: { theme: theme.palette.mode, y: { formatter: (val: number) => `${val} be` } }
    }
  }, [stats?.heatmap_in?.matrix, hoursMode, theme, chartColors])

  const heatmapSeries = useMemo(() => {
    const m = stats?.heatmap_in?.matrix ?? []
    const heatmapHoursStart = 8
    const heatmapHoursEnd = hoursMode === 'all' ? 23 : 17
    const hourLabels = heatmapHourLabels(heatmapHoursStart, heatmapHoursEnd)
    return HEATMAP_WEEKDAY_LABELS.map((name, wd) => {
      const row = Array.isArray(m[wd]) ? m[wd] : Array.from({ length: 24 }, () => 0)
      const values = row.slice(heatmapHoursStart, heatmapHoursEnd + 1)
      return {
        name,
        data: hourLabels.map((x, i) => ({ x, y: Number(values[i]) || 0 }))
      }
    })
  }, [stats?.heatmap_in?.matrix, hoursMode])

  const weekdayChartOptions = useMemo(() => {
    const profile = stats?.weekday_profile ?? []
    return {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: theme.typography.fontFamily },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: profile.map(p => p.label) },
      yaxis: { title: { text: 'Átlag belépő / nap' } },
      colors: [chartColors.accent],
      grid: { strokeDashArray: 3 },
      tooltip: {
        theme: theme.palette.mode,
        y: {
          formatter: (val: number, opts: { dataPointIndex: number }) => {
            const p = profile[opts.dataPointIndex]
            return `${formatAvg(val)} (${p?.sample_days ?? 0} nap)`
          }
        }
      }
    }
  }, [stats?.weekday_profile, theme, chartColors])

  const weekdayChartSeries = useMemo(() => {
    const profile = stats?.weekday_profile ?? []
    return [{ name: 'Átlag Be', data: profile.map(p => Math.round((Number(p.avg_in) || 0) * 10) / 10) }]
  }, [stats?.weekday_profile])

  const yearTotals = useMemo(() => {
    const months = stats?.series_months_12 ?? []
    let inSum = 0
    let outSum = 0
    for (const m of months) {
      inSum += Number(m.total_in) || 0
      outSum += Number(m.total_out) || 0
    }
    return { inSum, outSum, total: inSum + outSum }
  }, [stats?.series_months_12])

  const yearSeasonOptions = useMemo(() => {
    const months = stats?.series_months_12 ?? []
    const onSelect = chartOpts?.onYearMonthSelect
    const selectedKey = chartOpts?.selectedMonthKey
    // ApexCharts cannot parse MUI CSS-var colors (text.secondary) — use grey palette hex
    const labelMuted = theme.palette.grey[theme.palette.mode === 'dark' ? 400 : 600]
    return {
      chart: {
        type: 'bar' as const,
        toolbar: { show: false },
        fontFamily: theme.typography.fontFamily,
        events: {
          click: (
            _event: unknown,
            _chartContext: unknown,
            config: { dataPointIndex: number }
          ) => {
            const idx = config.dataPointIndex
            if (idx < 0) return
            const key = months[idx]?.month_key
            if (key && onSelect) onSelect(key)
          }
        }
      },
      plotOptions: { bar: { horizontal: false, columnWidth: '62%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: months.map(m => formatMonthKeyLabel(m.month_key)),
        title: { text: 'Hónap' },
        labels: {
          rotate: -45,
          style: {
            fontSize: '11px',
            colors: months.map(m => (m.month_key === selectedKey ? chartColors.in : labelMuted))
          }
        }
      },
      yaxis: { title: { text: 'Belépő / kilépő' } },
      colors: [chartColors.in, chartColors.out],
      legend: { position: 'top' as const },
      tooltip: {
        shared: true,
        intersect: false,
        theme: theme.palette.mode,
        y: { formatter: (val: number) => val.toLocaleString('hu-HU') }
      },
      grid: { strokeDashArray: 3 }
    }
  }, [stats?.series_months_12, theme, chartColors, chartOpts?.onYearMonthSelect, chartOpts?.selectedMonthKey])

  const yearSeasonSeries = useMemo(() => {
    const months = stats?.series_months_12 ?? []
    return [
      { name: 'Be', data: months.map(m => Number(m.total_in) || 0) },
      { name: 'Ki', data: months.map(m => Number(m.total_out) || 0) }
    ]
  }, [stats?.series_months_12])

  return {
    monthTotals,
    monthTrafficOptions,
    monthTrafficSeries,
    hourlyOptions,
    hourlySeries,
    heatmapOptions,
    heatmapSeries,
    weekdayChartOptions,
    weekdayChartSeries,
    yearTotals,
    yearSeasonOptions,
    yearSeasonSeries
  }
}

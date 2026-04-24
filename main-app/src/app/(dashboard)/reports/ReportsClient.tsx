'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import NextLink from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

import type { ApexOptions } from 'apexcharts'

import {
  Box,
  Breadcrumbs,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  LinearProgress,
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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  Home as HomeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material'

import { usePagePermission } from '@/hooks/usePagePermission'
import WorkshopMetersReportSection from './WorkshopMetersReportSection'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PeriodKey = 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'last_year' | 'month' | 'custom'
type Granularity = 'day' | 'week' | 'month'
type MaterialSort = 'gross' | 'm2' | 'profit'

interface SeriesRow {
  period: string
  quote_count: number
  cutting_length_m: number
  tabla_m2: number
  edge_length_m: number
  material_gross: number
  cutting_gross: number
  edge_materials_gross: number
  services_gross: number
  lines_gross_total: number
  estimated_material_cost: number
  estimated_material_profit: number
  production_days: number
}

interface TopCustomerRow {
  customer_id: string
  customer_name: string
  quote_count: number
  total_gross: number
}

interface TopMaterialRow {
  material_id: string
  material_name: string
  thickness_mm: number
  material_gross: number
  tabla_m2: number
  quote_count: number
  estimated_cost: number
  estimated_profit: number
  on_stock: boolean
}

interface QuoteFunnelRow {
  total_quotes: number
  draft_count: number
  draft_value_gross: number
  won_count: number
  won_value_gross: number
  cancelled_count: number
  cancelled_value_gross: number
  conversion_pct: number
  draft_share_pct: number
}

interface DashboardData {
  series: SeriesRow[]
  kpi: SeriesRow | null
  prevKpi: SeriesRow | null
  topCustomers: TopCustomerRow[]
  topMaterials: TopMaterialRow[]
  quoteFunnel: QuoteFunnelRow | null
  filters: { start: string; end: string; granularity: Granularity }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function fmtIsoDateHu(iso: string): string {
  const p = iso.split('-').map(Number)
  if (p.length !== 3 || p.some(Number.isNaN)) return iso
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('hu-HU')
}

function periodToRange(
  period: PeriodKey,
  opts?: { selectedMonthIso?: string; customStart?: string; customEnd?: string }
): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()

  switch (period) {
    case 'this_week': {
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const mon = new Date(y, m, d + diff)
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
      return { start: fmtDate(mon), end: fmtDate(sun) }
    }
    case 'this_month':
      return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3
      return { start: fmtDate(new Date(y, qStart, 1)), end: fmtDate(new Date(y, qStart + 3, 0)) }
    }
    case 'this_year':
      return { start: `${y}-01-01`, end: fmtDate(now) }
    case 'last_year':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'month': {
      const iso = opts?.selectedMonthIso
      if (iso) {
        const [ys, ms] = iso.split('-').map(Number)
        if (ys && ms) return { start: fmtDate(new Date(ys, ms - 1, 1)), end: fmtDate(new Date(ys, ms, 0)) }
      }
      return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) }
    }
    case 'custom': {
      const cs = opts?.customStart
      const ce = opts?.customEnd
      if (cs && ce) return { start: cs, end: ce }
      return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(now) }
    }
    default:
      return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) }
  }
}

function generateMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
    options.push({ value: val, label })
  }
  return options
}

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'this_week', label: 'Hét' },
  { key: 'this_month', label: 'Hónap' },
  { key: 'this_quarter', label: 'Negyedév' },
  { key: 'this_year', label: 'Idén' },
  { key: 'last_year', label: 'Tavaly' },
  { key: 'month', label: 'Válassz hónapot' },
  { key: 'custom', label: 'Egyéni' }
]

const GRAN_OPTIONS: Array<{ key: Granularity; label: string }> = [
  { key: 'day', label: 'Napi' },
  { key: 'week', label: 'Heti' },
  { key: 'month', label: 'Havi' }
]

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const fmtNum = (v: number) => Math.round(v).toLocaleString('hu-HU')
const fmtCurrency = (v: number) => `${fmtNum(v)} Ft`
const fmtCurrencyK = (v: number) => `${Math.round(v / 1000).toLocaleString('hu-HU')} e Ft`
const fmtMeters = (v: number) => `${v.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
const fmtSqm = (v: number) => `${v.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} m²`
const fmtPct = (v: number) => `${v.toFixed(1)}%`

function fmtPeriodLabel(iso: string, gran: Granularity): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (gran === 'day') return d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
  if (gran === 'week') {
    const target = new Date(d.valueOf())
    const dayNr = (d.getUTCDay() + 6) % 7
    target.setUTCDate(target.getUTCDate() - dayNr + 3)
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
    const week = 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / (7 * 24 * 3600 * 1000))
    return `${d.getUTCFullYear()}. ${String(week).padStart(2, '0')}. hét`
  }
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

// ---------------------------------------------------------------------------
// Theme colors (from colorSchemes.ts)
// ---------------------------------------------------------------------------

const C = {
  black: '#000000',
  teal: '#0F7B6C',
  orange: '#D9730D',
  blue: '#0B6E99',
  gray: '#9B9A97',
  red: '#E03E3E',
  green: '#16A085'
}

/** Per-bar colors: alsó harmad piros, közép narancs, felső harmad zöld (időszakon belüli relatív). */
function computeRevenueBarColors(linesGrossTotals: number[]): string[] {
  const n = linesGrossTotals.length
  if (n === 0) return []
  const values = linesGrossTotals.map(v => Math.round(v))
  const barColors = values.map(() => C.orange)
  const indexed = values.map((v, i) => ({ i, v }))
  indexed.sort((a, b) => a.v - b.v)
  if (indexed[0].v === indexed[n - 1].v) return values.map(() => C.orange)
  if (n === 1) return barColors
  if (n === 2) {
    barColors[indexed[0].i] = C.red
    barColors[indexed[1].i] = C.green
    return barColors
  }
  const lowCount = Math.floor(n / 3)
  const highCount = Math.floor(n / 3)
  const highMin = n - highCount
  for (let k = 0; k < n; k++) {
    const origIdx = indexed[k].i
    if (k < lowCount) barColors[origIdx] = C.red
    else if (k >= highMin) barColors[origIdx] = C.green
    else barColors[origIdx] = C.orange
  }
  return barColors
}

interface OverheadItem { id: number; name: string; perDay: number }

const DEFAULT_OVERHEADS: OverheadItem[] = [
  { id: 1, name: 'Munkaerő', perDay: 356_500 },
  { id: 2, name: 'Bérleti díj', perDay: 0 },
  { id: 3, name: 'Villany / rezsi', perDay: 0 }
]

const DEFAULT_EDGE_MATERIAL_PER_M = 250

const toggleBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.8125rem',
  px: 1.75,
  py: 0.6,
  borderColor: 'divider',
  '&.Mui-selected': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '&:hover': { bgcolor: 'primary.dark' }
  }
}

const totalsRowSx = { bgcolor: '#F5F5F7', '& td, & th': { fontWeight: 700 } }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportsClient() {
  const router = useRouter()
  const { hasAccess, loading } = usePagePermission('/reports')

  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [materialSort, setMaterialSort] = useState<MaterialSort>('gross')
  const [selectedMonthIso, setSelectedMonthIso] = useState<string>(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [customStart, setCustomStart] = useState<string>(() => {
    const n = new Date()
    return fmtDate(new Date(n.getFullYear(), n.getMonth(), 1))
  })
  const [customEnd, setCustomEnd] = useState<string>(() => fmtDate(new Date()))

  const [showRevenueTable, setShowRevenueTable] = useState(false)
  const [showVolumeTable, setShowVolumeTable] = useState(false)
  const [showProfitTable, setShowProfitTable] = useState(true)

  const [overheads, setOverheads] = useState<OverheadItem[]>(DEFAULT_OVERHEADS)
  const [edgeMaterialPerM, setEdgeMaterialPerM] = useState(DEFAULT_EDGE_MATERIAL_PER_M)
  const [nextOverheadId, setNextOverheadId] = useState(DEFAULT_OVERHEADS.length + 1)

  const overheadPerDay = useMemo(() => overheads.reduce((s, o) => s + o.perDay, 0), [overheads])

  const addOverhead = useCallback(() => {
    setOverheads(prev => [...prev, { id: nextOverheadId, name: '', perDay: 0 }])
    setNextOverheadId(v => v + 1)
  }, [nextOverheadId])

  const removeOverhead = useCallback((id: number) => {
    setOverheads(prev => prev.filter(o => o.id !== id))
  }, [])

  const updateOverhead = useCallback((id: number, field: 'name' | 'perDay', value: string | number) => {
    setOverheads(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  }, [])

  const monthOptions = useMemo(() => generateMonthOptions(), [])

  const [data, setData] = useState<DashboardData | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast.error('Nincs jogosultsága a Riportok oldal megtekintéséhez!', { position: 'top-right' })
      router.push('/home')
    }
  }, [hasAccess, loading, router])

  const fetchDashboard = useCallback(async () => {
    if (!hasAccess) return
    setDataLoading(true)
    setDataError(null)
    try {
      const { start, end } = periodToRange(period, { selectedMonthIso, customStart, customEnd })
      const url = `/api/reports/dashboard?start=${start}&end=${end}&granularity=${granularity}`
      const res = await fetch(url)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Adatok lekérése sikertelen')
      setData({
        series: body.series || [],
        kpi: body.kpi || null,
        prevKpi: body.prevKpi || null,
        topCustomers: body.topCustomers || [],
        topMaterials: body.topMaterials || [],
        quoteFunnel: body.quoteFunnel ?? null,
        filters: body.filters || { start, end, granularity }
      })
    } catch (e) {
      console.error('dashboard fetch:', e)
      setDataError(e instanceof Error ? e.message : 'Ismeretlen hiba')
    } finally {
      setDataLoading(false)
    }
  }, [hasAccess, period, granularity, selectedMonthIso, customStart, customEnd])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const sortedMaterials = useMemo(() => {
    if (!data?.topMaterials?.length) return []
    const sorted = [...data.topMaterials]
    if (materialSort === 'm2') sorted.sort((a, b) => b.tabla_m2 - a.tabla_m2)
    else if (materialSort === 'profit') sorted.sort((a, b) => b.estimated_profit - a.estimated_profit)
    return sorted
  }, [data?.topMaterials, materialSort])

  const seriesTotals = useMemo(() => {
    if (!data?.series?.length) return null
    return data.series.reduce(
      (acc, r) => ({
        quote_count: acc.quote_count + r.quote_count,
        cutting_length_m: acc.cutting_length_m + r.cutting_length_m,
        edge_length_m: acc.edge_length_m + r.edge_length_m,
        tabla_m2: acc.tabla_m2 + r.tabla_m2,
        material_gross: acc.material_gross + r.material_gross,
        cutting_gross: acc.cutting_gross + r.cutting_gross,
        edge_materials_gross: acc.edge_materials_gross + r.edge_materials_gross,
        services_gross: acc.services_gross + r.services_gross,
        lines_gross_total: acc.lines_gross_total + r.lines_gross_total,
        estimated_material_cost: acc.estimated_material_cost + r.estimated_material_cost,
        estimated_material_profit: acc.estimated_material_profit + r.estimated_material_profit,
        production_days: acc.production_days + r.production_days
      }),
      { quote_count: 0, cutting_length_m: 0, edge_length_m: 0, tabla_m2: 0, material_gross: 0, cutting_gross: 0, edge_materials_gross: 0, services_gross: 0, lines_gross_total: 0, estimated_material_cost: 0, estimated_material_profit: 0, production_days: 0 }
    )
  }, [data?.series])

  // ---------------------------------------------------------------------------
  // TIER 1: KPI cards (current month, fixed)
  // ---------------------------------------------------------------------------

  const kpiCards = useMemo(() => {
    const c = data?.kpi
    const p = data?.prevKpi
    if (!c) return null

    const avgCurrent = c.quote_count > 0 ? c.lines_gross_total / c.quote_count : 0
    const avgPrev = (p?.quote_count ?? 0) > 0 ? (p?.lines_gross_total ?? 0) / (p?.quote_count ?? 1) : 0

    const cDirectCost = c.estimated_material_cost + c.edge_length_m * edgeMaterialPerM
    const cOverhead = c.production_days * overheadPerDay
    const cNetProfit = c.lines_gross_total - cDirectCost - cOverhead

    const pDirectCost = (p?.estimated_material_cost ?? 0) + (p?.edge_length_m ?? 0) * edgeMaterialPerM
    const pOverhead = (p?.production_days ?? 0) * overheadPerDay
    const pNetProfit = (p?.lines_gross_total ?? 0) - pDirectCost - pOverhead

    return [
      { label: 'Bevétel összesen', value: fmtCurrency(c.lines_gross_total), delta: deltaPercent(c.lines_gross_total, p?.lines_gross_total ?? 0), highlight: false },
      { label: 'Becsült nettó profit', value: fmtCurrency(cNetProfit), delta: deltaPercent(cNetProfit, pNetProfit), highlight: true },
      { label: 'Ajánlatok', value: fmtNum(c.quote_count), delta: deltaPercent(c.quote_count, p?.quote_count ?? 0), highlight: false },
      { label: 'Feldolgozott m²', value: fmtSqm(c.tabla_m2), delta: deltaPercent(c.tabla_m2, p?.tabla_m2 ?? 0), highlight: false },
      { label: 'Átlag ajánlat érték', value: fmtCurrency(avgCurrent), delta: deltaPercent(avgCurrent, avgPrev), highlight: false }
    ]
  }, [data?.kpi, data?.prevKpi, edgeMaterialPerM, overheadPerDay])

  // ---------------------------------------------------------------------------
  // TIER 2A: Revenue trend (bar chart)
  // ---------------------------------------------------------------------------

  const revenueTrendSeries = useMemo(() => {
    if (!data?.series?.length) return []
    const cats = data.series.map(r => fmtPeriodLabel(r.period, granularity))
    return [{ name: 'Bevétel összesen', data: data.series.map((r, i) => ({ x: cats[i], y: Math.round(r.lines_gross_total) })) }]
  }, [data?.series, granularity])

  const revenueBarColors = useMemo(
    () => computeRevenueBarColors(data?.series?.map(r => r.lines_gross_total) ?? []),
    [data?.series]
  )

  const revenueTrendOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: 280, toolbar: { show: false }, zoom: { enabled: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: true } },
    dataLabels: { enabled: false },
    colors: revenueBarColors.length ? revenueBarColors : [C.black],
    legend: { show: false },
    xaxis: {
      type: 'category',
      labels: {
        style: { fontSize: '11px' },
        rotate: granularity === 'day' ? -45 : 0,
        rotateAlways: granularity === 'day'
      }
    },
    yaxis: { labels: { formatter: fmtCurrencyK, style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v: number) => fmtCurrency(v) } },
    grid: { strokeDashArray: 3, borderColor: '#E3E2DD' }
  }), [granularity, revenueBarColors])

  // Revenue composition (horizontal bar for total period)
  const revenueComposition = useMemo(() => {
    if (!seriesTotals || seriesTotals.lines_gross_total === 0) return null
    const total = seriesTotals.lines_gross_total
    return [
      { label: 'Bútórlap eladási áron', value: seriesTotals.material_gross, pct: (seriesTotals.material_gross / total) * 100, color: C.black },
      { label: 'Szabás díj', value: seriesTotals.cutting_gross, pct: (seriesTotals.cutting_gross / total) * 100, color: C.orange },
      { label: 'Élzárás', value: seriesTotals.edge_materials_gross, pct: (seriesTotals.edge_materials_gross / total) * 100, color: C.teal },
      { label: 'Szolgáltatások', value: seriesTotals.services_gross, pct: (seriesTotals.services_gross / total) * 100, color: C.gray }
    ]
  }, [seriesTotals])

  // ---------------------------------------------------------------------------
  // Profit calculation (client-side from production_days + cost constants)
  // ---------------------------------------------------------------------------

  const profitRows = useMemo(() => {
    if (!data?.series?.length) return null
    return data.series.map(row => {
      const edgeDirectCost = row.edge_length_m * edgeMaterialPerM
      const directCost = row.estimated_material_cost + edgeDirectCost
      const grossMargin = row.lines_gross_total - directCost
      const overhead = row.production_days * overheadPerDay
      const netProfit = grossMargin - overhead
      return {
        period: row.period,
        production_days: row.production_days,
        material_gross: row.material_gross,
        material_cost: row.estimated_material_cost,
        material_profit: row.estimated_material_profit,
        cutting_gross: row.cutting_gross,
        edge_gross: row.edge_materials_gross,
        edge_direct_cost: edgeDirectCost,
        edge_margin: row.edge_materials_gross - edgeDirectCost,
        services_gross: row.services_gross,
        total_gross: row.lines_gross_total,
        direct_cost: directCost,
        gross_margin: grossMargin,
        overhead,
        net_profit: netProfit
      }
    })
  }, [data?.series, edgeMaterialPerM, overheadPerDay])

  const profitTotals = useMemo(() => {
    if (!profitRows?.length) return null
    return profitRows.reduce((acc, r) => ({
      production_days: acc.production_days + r.production_days,
      material_gross: acc.material_gross + r.material_gross,
      material_cost: acc.material_cost + r.material_cost,
      material_profit: acc.material_profit + r.material_profit,
      cutting_gross: acc.cutting_gross + r.cutting_gross,
      edge_gross: acc.edge_gross + r.edge_gross,
      edge_direct_cost: acc.edge_direct_cost + r.edge_direct_cost,
      edge_margin: acc.edge_margin + r.edge_margin,
      services_gross: acc.services_gross + r.services_gross,
      total_gross: acc.total_gross + r.total_gross,
      direct_cost: acc.direct_cost + r.direct_cost,
      gross_margin: acc.gross_margin + r.gross_margin,
      overhead: acc.overhead + r.overhead,
      net_profit: acc.net_profit + r.net_profit
    }), {
      production_days: 0, material_gross: 0, material_cost: 0, material_profit: 0,
      cutting_gross: 0, edge_gross: 0, edge_direct_cost: 0, edge_margin: 0,
      services_gross: 0, total_gross: 0, direct_cost: 0, gross_margin: 0,
      overhead: 0, net_profit: 0
    })
  }, [profitRows])

  // ---------------------------------------------------------------------------
  // TIER 2B: Volume — 3 separate mini charts
  // ---------------------------------------------------------------------------

  const makeMiniBarSeries = (field: 'cutting_length_m' | 'edge_length_m' | 'tabla_m2') => {
    if (!data?.series?.length) return []
    const cats = data.series.map(r => fmtPeriodLabel(r.period, granularity))
    return [{ name: field, data: data.series.map((r, i) => ({ x: cats[i], y: Math.round(r[field] * 100) / 100 })) }]
  }

  const miniBarOpts = (color: string, fmtFn: (v: number) => string): ApexOptions => ({
    chart: { type: 'bar', height: 180, toolbar: { show: false }, zoom: { enabled: false } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    colors: [color],
    xaxis: { type: 'category', labels: { show: true, style: { fontSize: '10px' }, rotate: -45, rotateAlways: false } },
    yaxis: { labels: { formatter: (v: number) => String(Math.round(v)), style: { fontSize: '10px' } } },
    tooltip: { y: { formatter: (v: number) => fmtFn(v) } },
    grid: { strokeDashArray: 3, borderColor: '#E3E2DD' }
  })

  const cuttingSeries = useMemo(() => makeMiniBarSeries('cutting_length_m'), [data?.series, granularity]) // eslint-disable-line react-hooks/exhaustive-deps
  const edgeSeries = useMemo(() => makeMiniBarSeries('edge_length_m'), [data?.series, granularity]) // eslint-disable-line react-hooks/exhaustive-deps
  const m2Series = useMemo(() => makeMiniBarSeries('tabla_m2'), [data?.series, granularity]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuttingOpts = useMemo(() => miniBarOpts(C.black, fmtMeters), []) // eslint-disable-line react-hooks/exhaustive-deps
  const edgeOpts = useMemo(() => miniBarOpts(C.teal, fmtMeters), []) // eslint-disable-line react-hooks/exhaustive-deps
  const m2Opts = useMemo(() => miniBarOpts(C.orange, fmtSqm), []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasAnyVolume = useMemo(() => {
    if (!data?.series?.length) return false
    return data.series.some(r => r.cutting_length_m > 0 || r.edge_length_m > 0 || r.tabla_m2 > 0)
  }, [data?.series])

  const hasRevenue = useMemo(() => revenueTrendSeries[0]?.data?.some(p => p.y > 0) ?? false, [revenueTrendSeries])

  // ---------------------------------------------------------------------------
  // TIER 3: Top customer / material max values for progress bars
  // ---------------------------------------------------------------------------

  const customerMax = useMemo(() => {
    if (!data?.topCustomers?.length) return 1
    return data.topCustomers[0]?.total_gross || 1
  }, [data?.topCustomers])

  const materialMaxGross = useMemo(() => {
    if (!sortedMaterials.length) return 1
    if (materialSort === 'm2') return Math.max(...sortedMaterials.map(r => r.tabla_m2), 1)
    if (materialSort === 'profit') return Math.max(...sortedMaterials.map(r => Math.abs(r.estimated_profit)), 1)
    return Math.max(...sortedMaterials.map(r => r.material_gross), 1)
  }, [sortedMaterials, materialSort])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
  }
  if (!hasAccess) return null

  const currentMonthLabel = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Breadcrumb */}
      <Breadcrumbs aria-label='breadcrumb' sx={{ mb: 2 }}>
        <Link component={NextLink} underline='hover' color='inherit' href='/home' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize='small' />
          Főoldal
        </Link>
        <Typography color='text.primary' fontWeight={600}>Riportok</Typography>
      </Breadcrumbs>

      {/* ================================================================ */}
      {/* TIER 1: Pillanatkép — 4 hero KPI cards (current month, fixed)    */}
      {/* ================================================================ */}

      <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
        {currentMonthLabel} — aktuális hónap (nem változik a szűrővel)
      </Typography>

      {dataLoading && !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : dataError && !data ? (
        <Typography color='error' sx={{ mb: 3 }}>{dataError}</Typography>
      ) : kpiCards ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2, mb: 4 }}>
          {kpiCards.map(card => (
            <Paper key={card.label} variant='outlined' sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5, ...(card.highlight ? { borderColor: 'success.main', borderWidth: 2 } : {}) }}>
              <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem' }}>
                {card.label}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.25rem', md: '1.5rem' }, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                {card.value}
              </Typography>
              {card.delta !== null && (
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.25,
                  bgcolor: card.delta >= 0 ? alpha(C.teal, 0.08) : alpha(C.red, 0.08),
                  color: card.delta >= 0 ? 'success.main' : 'error.main',
                  px: 1, py: 0.25, borderRadius: 1, alignSelf: 'flex-start'
                }}>
                  {card.delta >= 0
                    ? <TrendingUpIcon sx={{ fontSize: 14 }} />
                    : <TrendingDownIcon sx={{ fontSize: 14 }} />}
                  <Typography variant='caption' sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    {card.delta >= 0 ? '+' : ''}{card.delta.toFixed(1)}%
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      ) : (
        <Typography color='text.secondary' sx={{ mb: 3 }}>Nincs adat az aktuális hónapra.</Typography>
      )}

      <WorkshopMetersReportSection />

      {/* ================================================================ */}
      {/* Filter bar                                                       */}
      {/* ================================================================ */}

      <Paper variant='outlined' sx={{ px: 2, py: 1.5, mb: 3 }}>
        <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
          <ToggleButtonGroup value={period} exclusive onChange={(_e, val) => { if (val) setPeriod(val) }} size='small'>
            {PERIOD_OPTIONS.map(o => (
              <ToggleButton key={o.key} value={o.key} sx={toggleBtnSx}>{o.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          {period === 'month' && (
            <Select value={selectedMonthIso} onChange={(e: SelectChangeEvent) => setSelectedMonthIso(e.target.value)} size='small' sx={{ minWidth: 200 }}>
              {monthOptions.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          )}
          {period === 'custom' && (
            <>
              <TextField type='date' size='small' label='Kezdő dátum' value={customStart} onChange={e => setCustomStart(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 165 }} />
              <Typography variant='body2' color='text.secondary'>—</Typography>
              <TextField type='date' size='small' label='Záró dátum' value={customEnd} onChange={e => setCustomEnd(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 165 }} />
            </>
          )}
          <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 0.5 }} />
          <ToggleButtonGroup value={granularity} exclusive onChange={(_e, val) => { if (val) setGranularity(val) }} size='small'>
            {GRAN_OPTIONS.map(o => (
              <ToggleButton key={o.key} value={o.key} sx={toggleBtnSx}>{o.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* Loading / Error */}
      {dataLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
      {dataError && <Typography color='error' sx={{ mb: 3 }}>{dataError}</Typography>}

      {!dataLoading && !dataError && data && (
        <>
          {/* ============================================================ */}
          {/* Quote funnel (created_at, same filter as charts)              */}
          {/* ============================================================ */}

          {data.quoteFunnel && (
            <Paper variant='outlined' sx={{ p: 3, mb: 3 }}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 0.5 }}>
                Ajánlat konverzió
              </Typography>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
                Létrehozás dátuma (Budapest idő) — {fmtIsoDateHu(data.filters.start)} – {fmtIsoDateHu(data.filters.end)} · konverzió = éles ajánlat / összes létrehozott (lemondás csökkenti az arányt)
              </Typography>

              {data.quoteFunnel.total_quotes === 0 ? (
                <Typography color='text.secondary'>Ebben az időszakban nem jött létre ajánlat.</Typography>
              ) : (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} md={3}>
                      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Konverzió
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', md: '1.6rem' }, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtPct(data.quoteFunnel.conversion_pct)}
                      </Typography>
                      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25 }}>
                        Piszkozat arány: {fmtPct(data.quoteFunnel.draft_share_pct)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Piszkozatban
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(data.quoteFunnel.draft_count)} db
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>{fmtCurrency(data.quoteFunnel.draft_value_gross)}</Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Éles ajánlat
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(data.quoteFunnel.won_count)} db
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>{fmtCurrency(data.quoteFunnel.won_value_gross)}</Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        Lemondva
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(data.quoteFunnel.cancelled_count)} db
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>{fmtCurrency(data.quoteFunnel.cancelled_value_gross)}</Typography>
                    </Grid>
                  </Grid>

                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                    Megoszlás (db) — összesen {fmtNum(data.quoteFunnel.total_quotes)} ajánlat
                  </Typography>
                  <Box sx={{ display: 'flex', height: 28, borderRadius: 1, overflow: 'hidden', mb: 1.5 }}>
                    {(() => {
                      const t = data.quoteFunnel.total_quotes
                      const draftPct = t > 0 ? (data.quoteFunnel.draft_count / t) * 100 : 0
                      const wonPct = t > 0 ? (data.quoteFunnel.won_count / t) * 100 : 0
                      const cancelPct = t > 0 ? (data.quoteFunnel.cancelled_count / t) * 100 : 0
                      const segs = [
                        { label: 'Piszkozat', pct: draftPct, color: C.orange },
                        { label: 'Éles', pct: wonPct, color: C.teal },
                        { label: 'Lemondva', pct: cancelPct, color: C.red }
                      ]
                      return segs.map(seg => (
                        <Tooltip key={seg.label} title={`${seg.label}: ${fmtPct(seg.pct)}`} arrow>
                          <Box sx={{ width: `${seg.pct}%`, bgcolor: seg.color, minWidth: seg.pct > 0 ? 2 : 0, transition: 'width 0.3s' }} />
                        </Tooltip>
                      ))
                    })()}
                  </Box>
                  <Stack direction='row' spacing={2.5} flexWrap='wrap' useFlexGap>
                    <Stack direction='row' alignItems='center' spacing={0.75}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: C.orange, flexShrink: 0 }} />
                      <Typography variant='caption' color='text.secondary'>Piszkozat <strong>{fmtNum(data.quoteFunnel.draft_count)}</strong></Typography>
                    </Stack>
                    <Stack direction='row' alignItems='center' spacing={0.75}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: C.teal, flexShrink: 0 }} />
                      <Typography variant='caption' color='text.secondary'>Éles <strong>{fmtNum(data.quoteFunnel.won_count)}</strong></Typography>
                    </Stack>
                    <Stack direction='row' alignItems='center' spacing={0.75}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: C.red, flexShrink: 0 }} />
                      <Typography variant='caption' color='text.secondary'>Lemondva <strong>{fmtNum(data.quoteFunnel.cancelled_count)}</strong></Typography>
                    </Stack>
                  </Stack>
                </>
              )}
            </Paper>
          )}

          {/* ============================================================ */}
          {/* TIER 2A: Bevétel trend + composition                         */}
          {/* ============================================================ */}

          <Paper variant='outlined' sx={{ p: 3, mb: 3 }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
              <Box>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>Bevétel trend</Typography>
                <Typography variant='caption' color='text.secondary'>
                  Oszlopdiagram — szín az időszakon belüli relatív szint (alacsony → piros, közepes → narancs, erős → zöld)
                </Typography>
              </Box>
              {seriesTotals && (
                <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(seriesTotals.lines_gross_total)}
                </Typography>
              )}
            </Stack>

            {hasRevenue ? (
              <>
                <ReactApexChart options={revenueTrendOptions} series={revenueTrendSeries} type='bar' height={280} />
                <Stack direction='row' spacing={2} flexWrap='wrap' useFlexGap sx={{ mt: 1, justifyContent: 'center' }}>
                  <Stack direction='row' alignItems='center' spacing={0.75}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: C.red, flexShrink: 0 }} />
                    <Typography variant='caption' color='text.secondary'>Alacsony (alsó ~harmad)</Typography>
                  </Stack>
                  <Stack direction='row' alignItems='center' spacing={0.75}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: C.orange, flexShrink: 0 }} />
                    <Typography variant='caption' color='text.secondary'>Közepes</Typography>
                  </Stack>
                  <Stack direction='row' alignItems='center' spacing={0.75}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: C.green, flexShrink: 0 }} />
                    <Typography variant='caption' color='text.secondary'>Erős (felső ~harmad)</Typography>
                  </Stack>
                </Stack>
              </>
            ) : (
              <Typography color='text.secondary' sx={{ py: 6, textAlign: 'center' }}>Nincs bevételi adat a választott időszakra.</Typography>
            )}

            {/* Revenue composition bar */}
            {revenueComposition && (
              <Box sx={{ mt: 2 }}>
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Bevétel összetétel — teljes időszak
                </Typography>
                {/* Stacked horizontal bar */}
                <Box sx={{ display: 'flex', height: 28, borderRadius: 1, overflow: 'hidden', mb: 1.5 }}>
                  {revenueComposition.map(seg => (
                    <Tooltip key={seg.label} title={`${seg.label}: ${fmtCurrency(seg.value)} (${fmtPct(seg.pct)})`} arrow>
                      <Box sx={{ width: `${seg.pct}%`, bgcolor: seg.color, minWidth: seg.pct > 0 ? 2 : 0, transition: 'width 0.3s' }} />
                    </Tooltip>
                  ))}
                </Box>
                {/* Legend */}
                <Stack direction='row' spacing={2.5} flexWrap='wrap' useFlexGap>
                  {revenueComposition.map(seg => (
                    <Stack key={seg.label} direction='row' alignItems='center' spacing={0.75}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: seg.color, flexShrink: 0 }} />
                      <Typography variant='caption' color='text.secondary'>
                        {seg.label} <strong>{fmtPct(seg.pct)}</strong>
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Collapsible revenue data table */}
            <Box sx={{ mt: 2 }}>
              <Stack direction='row' alignItems='center' spacing={0.5} sx={{ cursor: 'pointer' }} onClick={() => setShowRevenueTable(v => !v)}>
                <IconButton size='small'>{showRevenueTable ? <CollapseIcon fontSize='small' /> : <ExpandIcon fontSize='small' />}</IconButton>
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                  {showRevenueTable ? 'Részletes tábla elrejtése' : 'Részletes tábla megjelenítése'}
                </Typography>
              </Stack>
              <Collapse in={showRevenueTable}>
                <TableContainer component={Box} sx={{ mt: 1, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, overflowX: 'auto' }}>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Időszak</TableCell>
                        <TableCell align='right'>Ajánlatok</TableCell>
                        <TableCell align='right'>Bútórlap</TableCell>
                        <TableCell align='right'>Szabás díj</TableCell>
                        <TableCell align='right'>Élzárás</TableCell>
                        <TableCell align='right'>Szolgáltatások</TableCell>
                        <TableCell align='right'>Összesen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.series.map(row => (
                        <TableRow key={row.period}>
                          <TableCell>{fmtPeriodLabel(row.period, granularity)}</TableCell>
                          <TableCell align='right'>{row.quote_count}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.material_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.cutting_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.edge_materials_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.services_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.lines_gross_total)}</TableCell>
                        </TableRow>
                      ))}
                      {seriesTotals && (
                        <TableRow sx={totalsRowSx}>
                          <TableCell>Összesen</TableCell>
                          <TableCell align='right'>{seriesTotals.quote_count}</TableCell>
                          <TableCell align='right'>{fmtCurrency(seriesTotals.material_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(seriesTotals.cutting_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(seriesTotals.edge_materials_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(seriesTotals.services_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(seriesTotals.lines_gross_total)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          </Paper>

          {/* ============================================================ */}
          {/* Becsült árrés összesítő                                      */}
          {/* ============================================================ */}

          {profitTotals && (
            <Paper variant='outlined' sx={{ p: 3, mb: 3 }}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 2 }}>Becsült árrés kalkuláció</Typography>

              <Grid container spacing={3}>
                {/* Left: mini P&L */}
                <Grid item xs={12} md={7}>
                  <TableContainer component={Box} sx={{ borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}` }}>
                    <Table size='small'>
                      <TableBody>
                        {/* Revenue */}
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Bevétel összesen</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(profitTotals.total_gross)}</TableCell>
                        </TableRow>

                        {/* Direct costs */}
                        <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                          <TableCell sx={{ fontWeight: 600, pl: 3 }}>Anyag beszerzési költség</TableCell>
                          <TableCell align='right' sx={{ fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>−{fmtCurrency(profitTotals.material_cost)}</TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                          <TableCell sx={{ fontWeight: 600, pl: 3 }}>Élzárás anyagköltség ({fmtNum(edgeMaterialPerM)} Ft/m)</TableCell>
                          <TableCell align='right' sx={{ fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>−{fmtCurrency(profitTotals.edge_direct_cost)}</TableCell>
                        </TableRow>

                        {/* Gross margin */}
                        <TableRow sx={{ borderTop: '2px solid', borderColor: 'divider' }}>
                          <TableCell sx={{ fontWeight: 700 }}>Bruttó árrés (közvetlen költségek után)</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: profitTotals.gross_margin >= 0 ? 'success.main' : 'error.main' }}>
                            {fmtCurrency(profitTotals.gross_margin)}
                            {profitTotals.total_gross > 0 && (
                              <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 0.5 }}>
                                ({fmtPct((profitTotals.gross_margin / profitTotals.total_gross) * 100)})
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Overhead */}
                        {overheads.filter(o => o.perDay > 0).map(o => (
                          <TableRow key={o.id} sx={{ bgcolor: '#FAFAFA' }}>
                            <TableCell sx={{ fontWeight: 600, pl: 3 }}>{o.name || 'Névtelen'} ({fmtCurrency(o.perDay)}/nap × {profitTotals.production_days} nap)</TableCell>
                            <TableCell align='right' sx={{ fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>−{fmtCurrency(o.perDay * profitTotals.production_days)}</TableCell>
                          </TableRow>
                        ))}
                        {profitTotals.overhead > 0 && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Üzemi költségek összesen</TableCell>
                            <TableCell align='right' sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>−{fmtCurrency(profitTotals.overhead)}</TableCell>
                          </TableRow>
                        )}

                        {/* Net profit */}
                        <TableRow sx={{ bgcolor: profitTotals.net_profit >= 0 ? alpha(C.teal, 0.06) : alpha(C.red, 0.06) }}>
                          <TableCell sx={{ fontWeight: 800, fontSize: '1rem' }}>Becsült nettó profit</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 800, fontSize: '1rem', fontVariantNumeric: 'tabular-nums', color: profitTotals.net_profit >= 0 ? 'success.main' : 'error.main' }}>
                            {fmtCurrency(profitTotals.net_profit)}
                            {profitTotals.total_gross > 0 && (
                              <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 0.5 }}>
                                ({fmtPct((profitTotals.net_profit / profitTotals.total_gross) * 100)})
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
                    {profitTotals.production_days} munkanap &bull; Anyag: aktuális beszerzési ár alapján &bull; Szabás/szolg. költség nem kalkulált
                  </Typography>
                </Grid>

                {/* Right: editable cost inputs */}
                <Grid item xs={12} md={5}>
                  <Box sx={{ p: 2, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, bgcolor: '#FAFAFA' }}>
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
                      Közvetlen költség
                    </Typography>
                    <TextField
                      size='small' type='number' label='Élzárás anyag Ft/m'
                      value={edgeMaterialPerM} onChange={e => setEdgeMaterialPerM(Number(e.target.value) || 0)}
                      InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                      fullWidth sx={{ mb: 2.5 }}
                    />

                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', mb: 1.5 }}>
                      Üzemi költségek (Ft/nap)
                    </Typography>
                    <Stack spacing={1}>
                      {overheads.map(o => (
                        <Stack key={o.id} direction='row' spacing={1} alignItems='center'>
                          <TextField
                            size='small' label='Megnevezés' value={o.name}
                            onChange={e => updateOverhead(o.id, 'name', e.target.value)}
                            InputProps={{ sx: { fontSize: '0.8rem' } }}
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            size='small' type='number' label='Ft/nap' value={o.perDay}
                            onChange={e => updateOverhead(o.id, 'perDay', Number(e.target.value) || 0)}
                            InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                            sx={{ width: 130 }}
                          />
                          <IconButton size='small' onClick={() => removeOverhead(o.id)} sx={{ color: 'text.secondary' }}>
                            <CloseIcon fontSize='small' />
                          </IconButton>
                        </Stack>
                      ))}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
                        <IconButton size='small' onClick={addOverhead} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                          <AddIcon fontSize='small' />
                        </IconButton>
                        <Typography variant='caption' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          Összesen: {fmtCurrency(overheadPerDay)}/nap
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>

              {/* Collapsible detailed profit table */}
              <Box sx={{ mt: 2 }}>
                <Stack direction='row' alignItems='center' spacing={0.5} sx={{ cursor: 'pointer' }} onClick={() => setShowProfitTable(v => !v)}>
                  <IconButton size='small'>{showProfitTable ? <CollapseIcon fontSize='small' /> : <ExpandIcon fontSize='small' />}</IconButton>
                  <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                    {showProfitTable ? 'Időszakos bontás elrejtése' : 'Időszakos bontás megjelenítése'}
                  </Typography>
                </Stack>
                <Collapse in={showProfitTable}>
                  <TableContainer component={Box} sx={{ mt: 1, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, overflowX: 'auto' }}>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Időszak</TableCell>
                          <TableCell align='right'>Napok</TableCell>
                          <TableCell align='right'>Bevétel</TableCell>
                          <TableCell align='right'>Anyag ktg.</TableCell>
                          <TableCell align='right'>Élzárás anyag</TableCell>
                          <TableCell align='right'>Bruttó árrés</TableCell>
                          <TableCell align='right'>Üzemi ktg.</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 700 }}>Nettó profit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {profitRows?.map(row => (
                          <TableRow key={row.period}>
                            <TableCell>{fmtPeriodLabel(row.period, granularity)}</TableCell>
                            <TableCell align='right'>{row.production_days}</TableCell>
                            <TableCell align='right'>{fmtCurrency(row.total_gross)}</TableCell>
                            <TableCell align='right'>{fmtCurrency(row.material_cost)}</TableCell>
                            <TableCell align='right'>{fmtCurrency(row.edge_direct_cost)}</TableCell>
                            <TableCell align='right' sx={{ color: row.gross_margin >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.gross_margin)}</TableCell>
                            <TableCell align='right'>{fmtCurrency(row.overhead)}</TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700, color: row.net_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.net_profit)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={totalsRowSx}>
                          <TableCell>Összesen</TableCell>
                          <TableCell align='right'>{profitTotals.production_days}</TableCell>
                          <TableCell align='right'>{fmtCurrency(profitTotals.total_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(profitTotals.material_cost)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(profitTotals.edge_direct_cost)}</TableCell>
                          <TableCell align='right' sx={{ color: profitTotals.gross_margin >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.gross_margin)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(profitTotals.overhead)}</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 700, color: profitTotals.net_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.net_profit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>
            </Paper>
          )}

          {/* ============================================================ */}
          {/* TIER 2B: Volume — 3 separate mini charts                     */}
          {/* ============================================================ */}

          <Paper variant='outlined' sx={{ p: 3, mb: 3 }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
              <Box>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>Volumen</Typography>
                <Typography variant='caption' color='text.secondary'>Minden metrika külön tengelyen — nincs mértékegység-keveredés</Typography>
              </Box>
            </Stack>

            {hasAnyVolume ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, p: 1.5 }}>
                    <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Szabási hossz</Typography>
                    {seriesTotals && <Typography variant='body2' sx={{ fontWeight: 800, mb: 1 }}>{fmtMeters(seriesTotals.cutting_length_m)}</Typography>}
                    <ReactApexChart options={cuttingOpts} series={cuttingSeries} type='bar' height={180} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, p: 1.5 }}>
                    <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Élzárás hossz</Typography>
                    {seriesTotals && <Typography variant='body2' sx={{ fontWeight: 800, mb: 1 }}>{fmtMeters(seriesTotals.edge_length_m)}</Typography>}
                    <ReactApexChart options={edgeOpts} series={edgeSeries} type='bar' height={180} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, p: 1.5 }}>
                    <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Tábla m²</Typography>
                    {seriesTotals && <Typography variant='body2' sx={{ fontWeight: 800, mb: 1 }}>{fmtSqm(seriesTotals.tabla_m2)}</Typography>}
                    <ReactApexChart options={m2Opts} series={m2Series} type='bar' height={180} />
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Typography color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>Nincs megjeleníthető volumen adat.</Typography>
            )}

            {/* Collapsible volume data table */}
            <Box sx={{ mt: 2 }}>
              <Stack direction='row' alignItems='center' spacing={0.5} sx={{ cursor: 'pointer' }} onClick={() => setShowVolumeTable(v => !v)}>
                <IconButton size='small'>{showVolumeTable ? <CollapseIcon fontSize='small' /> : <ExpandIcon fontSize='small' />}</IconButton>
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                  {showVolumeTable ? 'Részletes tábla elrejtése' : 'Részletes tábla megjelenítése'}
                </Typography>
              </Stack>
              <Collapse in={showVolumeTable}>
                <TableContainer component={Box} sx={{ mt: 1, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, overflowX: 'auto' }}>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Időszak</TableCell>
                        <TableCell align='right'>Ajánlatok</TableCell>
                        <TableCell align='right'>Szabási hossz (m)</TableCell>
                        <TableCell align='right'>Élzárás hossz (m)</TableCell>
                        <TableCell align='right'>Tábla m²</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.series.map(row => (
                        <TableRow key={row.period}>
                          <TableCell>{fmtPeriodLabel(row.period, granularity)}</TableCell>
                          <TableCell align='right'>{row.quote_count}</TableCell>
                          <TableCell align='right'>{fmtMeters(row.cutting_length_m)}</TableCell>
                          <TableCell align='right'>{fmtMeters(row.edge_length_m)}</TableCell>
                          <TableCell align='right'>{fmtSqm(row.tabla_m2)}</TableCell>
                        </TableRow>
                      ))}
                      {seriesTotals && (
                        <TableRow sx={totalsRowSx}>
                          <TableCell>Összesen</TableCell>
                          <TableCell align='right'>{seriesTotals.quote_count}</TableCell>
                          <TableCell align='right'>{fmtMeters(seriesTotals.cutting_length_m)}</TableCell>
                          <TableCell align='right'>{fmtMeters(seriesTotals.edge_length_m)}</TableCell>
                          <TableCell align='right'>{fmtSqm(seriesTotals.tabla_m2)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          </Paper>

          {/* ============================================================ */}
          {/* TIER 3: Rankings — side-by-side                               */}
          {/* ============================================================ */}

          <Grid container spacing={3}>
            {/* Top 20 ügyfél */}
            <Grid item xs={12} lg={6}>
              <Paper variant='outlined' sx={{ p: 3, height: '100%' }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 2 }}>Top 20 ügyfél</Typography>
                {data.topCustomers.length === 0 ? (
                  <Typography color='text.secondary'>Nincs ügyfél adat a választott időszakra.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {data.topCustomers.map((row, idx) => {
                      const pct = (row.total_gross / customerMax) * 100
                      return (
                        <Box key={row.customer_id}>
                          <Stack direction='row' justifyContent='space-between' alignItems='baseline' sx={{ mb: 0.25 }}>
                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                              <Typography component='span' variant='caption' color='text.secondary' sx={{ mr: 0.75, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {idx + 1}.
                              </Typography>
                              {row.customer_name || 'Ismeretlen'}
                            </Typography>
                            <Stack direction='row' spacing={1.5} alignItems='baseline' sx={{ flexShrink: 0 }}>
                              <Typography variant='caption' color='text.secondary'>{row.quote_count} aj.</Typography>
                              <Typography variant='body2' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(row.total_gross)}</Typography>
                            </Stack>
                          </Stack>
                          <LinearProgress
                            variant='determinate'
                            value={pct}
                            sx={{
                              height: 4, borderRadius: 2,
                              bgcolor: theme => alpha(theme.palette.primary.main, 0.06),
                              '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: C.black }
                            }}
                          />
                        </Box>
                      )
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>

            {/* Top 20 anyag */}
            <Grid item xs={12} lg={6}>
              <Paper variant='outlined' sx={{ p: 3, height: '100%' }}>
                <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>Top 20 anyag</Typography>
                  <ToggleButtonGroup value={materialSort} exclusive onChange={(_e, val) => { if (val) setMaterialSort(val) }} size='small'>
                    <ToggleButton value='gross' sx={toggleBtnSx}>Bruttó ár</ToggleButton>
                    <ToggleButton value='m2' sx={toggleBtnSx}>m²</ToggleButton>
                    <ToggleButton value='profit' sx={toggleBtnSx}>Árrés</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                {sortedMaterials.length === 0 ? (
                  <Typography color='text.secondary'>Nincs anyag adat a választott időszakra.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {sortedMaterials.map((row, idx) => {
                      const val = materialSort === 'profit' ? Math.abs(row.estimated_profit) : materialSort === 'gross' ? row.material_gross : row.tabla_m2
                      const pct = (val / materialMaxGross) * 100
                      const barColor = materialSort === 'profit' ? (row.estimated_profit >= 0 ? C.teal : C.red) : materialSort === 'gross' ? C.orange : C.teal
                      return (
                        <Box key={row.material_id}>
                          <Stack direction='row' justifyContent='space-between' alignItems='baseline' sx={{ mb: 0.25 }}>
                            <Typography variant='body2' sx={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 1 }}>
                              <Typography component='span' variant='caption' color='text.secondary' sx={{ mr: 0.75, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {idx + 1}.
                              </Typography>
                              {row.material_name}
                              <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 0.75 }}>{row.thickness_mm} mm</Typography>
                              {!row.on_stock && (
                                <Typography component='span' variant='caption' sx={{ ml: 0.5, px: 0.75, py: 0.1, borderRadius: 0.5, bgcolor: alpha(C.red, 0.08), color: C.red, fontSize: '0.6rem', fontWeight: 600 }}>
                                  Nem raktáron
                                </Typography>
                              )}
                            </Typography>
                            <Stack direction='row' spacing={1.5} alignItems='baseline' sx={{ flexShrink: 0 }}>
                              <Typography variant='caption' color='text.secondary'>{row.quote_count} aj.</Typography>
                              {materialSort === 'gross' && row.estimated_profit !== 0 && (
                                <Typography variant='caption' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: row.estimated_profit >= 0 ? 'success.main' : 'error.main' }}>
                                  {row.estimated_profit >= 0 ? '+' : ''}{fmtCurrency(row.estimated_profit)}
                                </Typography>
                              )}
                              <Typography variant='body2' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', ...(materialSort === 'profit' ? { color: row.estimated_profit >= 0 ? 'success.main' : 'error.main' } : {}) }}>
                                {materialSort === 'profit' ? fmtCurrency(row.estimated_profit) : materialSort === 'gross' ? fmtCurrency(row.material_gross) : fmtSqm(row.tabla_m2)}
                              </Typography>
                            </Stack>
                          </Stack>
                          <LinearProgress
                            variant='determinate'
                            value={pct}
                            sx={{
                              height: 4, borderRadius: 2,
                              bgcolor: theme => alpha(barColor, 0.08),
                              '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: barColor }
                            }}
                          />
                        </Box>
                      )
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  )
}

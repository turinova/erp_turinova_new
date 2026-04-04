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
  KeyboardArrowUp as CollapseIcon
} from '@mui/icons-material'

import { usePagePermission } from '@/hooks/usePagePermission'

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

interface DashboardData {
  series: SeriesRow[]
  kpi: SeriesRow | null
  prevKpi: SeriesRow | null
  topCustomers: TopCustomerRow[]
  topMaterials: TopMaterialRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
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
  red: '#E03E3E'
}

const COST_DEFAULTS = {
  cutting_labor_per_day: 200_000,
  edge_labor_per_day: 156_500,
  edge_material_per_m: 250
}

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
  const [granularity, setGranularity] = useState<Granularity>('month')
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

  const [cuttingLaborPerDay, setCuttingLaborPerDay] = useState(COST_DEFAULTS.cutting_labor_per_day)
  const [edgeLaborPerDay, setEdgeLaborPerDay] = useState(COST_DEFAULTS.edge_labor_per_day)
  const [edgeMaterialPerM, setEdgeMaterialPerM] = useState(COST_DEFAULTS.edge_material_per_m)

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
        topMaterials: body.topMaterials || []
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

    const cCuttingCost = c.production_days * cuttingLaborPerDay
    const cEdgeCost = c.production_days * edgeLaborPerDay + c.edge_length_m * edgeMaterialPerM
    const cTotalProfit = c.lines_gross_total - c.estimated_material_cost - cCuttingCost - cEdgeCost

    const pCuttingCost = (p?.production_days ?? 0) * cuttingLaborPerDay
    const pEdgeCost = (p?.production_days ?? 0) * edgeLaborPerDay + (p?.edge_length_m ?? 0) * edgeMaterialPerM
    const pTotalProfit = (p?.lines_gross_total ?? 0) - (p?.estimated_material_cost ?? 0) - pCuttingCost - pEdgeCost

    return [
      { label: 'Bevétel összesen', value: fmtCurrency(c.lines_gross_total), delta: deltaPercent(c.lines_gross_total, p?.lines_gross_total ?? 0), highlight: false },
      { label: 'Becsült össz. árrés', value: fmtCurrency(cTotalProfit), delta: deltaPercent(cTotalProfit, pTotalProfit), highlight: true },
      { label: 'Ajánlatok', value: fmtNum(c.quote_count), delta: deltaPercent(c.quote_count, p?.quote_count ?? 0), highlight: false },
      { label: 'Feldolgozott m²', value: fmtSqm(c.tabla_m2), delta: deltaPercent(c.tabla_m2, p?.tabla_m2 ?? 0), highlight: false },
      { label: 'Átlag ajánlat érték', value: fmtCurrency(avgCurrent), delta: deltaPercent(avgCurrent, avgPrev), highlight: false }
    ]
  }, [data?.kpi, data?.prevKpi, cuttingLaborPerDay, edgeLaborPerDay, edgeMaterialPerM])

  // ---------------------------------------------------------------------------
  // TIER 2A: Revenue trend (single area chart)
  // ---------------------------------------------------------------------------

  const revenueTrendSeries = useMemo(() => {
    if (!data?.series?.length) return []
    const cats = data.series.map(r => fmtPeriodLabel(r.period, granularity))
    return [{ name: 'Bevétel összesen', data: data.series.map((r, i) => ({ x: cats[i], y: Math.round(r.lines_gross_total) })) }]
  }, [data?.series, granularity])

  const revenueTrendOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'area', height: 280, toolbar: { show: false }, zoom: { enabled: false }, sparkline: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02, shadeIntensity: 1 } },
    colors: [C.black],
    xaxis: { type: 'category', labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: fmtCurrencyK, style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v: number) => fmtCurrency(v) } },
    grid: { strokeDashArray: 3, borderColor: '#E3E2DD' }
  }), [])

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
      const cuttingCost = row.production_days * cuttingLaborPerDay
      const edgeLaborCost = row.production_days * edgeLaborPerDay
      const edgeMaterialCost = row.edge_length_m * edgeMaterialPerM
      const edgeCost = edgeLaborCost + edgeMaterialCost
      const totalCost = row.estimated_material_cost + cuttingCost + edgeCost
      const totalProfit = row.lines_gross_total - totalCost
      return {
        period: row.period,
        production_days: row.production_days,
        material_gross: row.material_gross,
        material_cost: row.estimated_material_cost,
        material_profit: row.estimated_material_profit,
        cutting_gross: row.cutting_gross,
        cutting_cost: cuttingCost,
        cutting_profit: row.cutting_gross - cuttingCost,
        edge_gross: row.edge_materials_gross,
        edge_cost: edgeCost,
        edge_profit: row.edge_materials_gross - edgeCost,
        services_gross: row.services_gross,
        total_gross: row.lines_gross_total,
        total_cost: totalCost,
        total_profit: totalProfit
      }
    })
  }, [data?.series, cuttingLaborPerDay, edgeLaborPerDay, edgeMaterialPerM])

  const profitTotals = useMemo(() => {
    if (!profitRows?.length) return null
    return profitRows.reduce((acc, r) => ({
      production_days: acc.production_days + r.production_days,
      material_gross: acc.material_gross + r.material_gross,
      material_cost: acc.material_cost + r.material_cost,
      material_profit: acc.material_profit + r.material_profit,
      cutting_gross: acc.cutting_gross + r.cutting_gross,
      cutting_cost: acc.cutting_cost + r.cutting_cost,
      cutting_profit: acc.cutting_profit + r.cutting_profit,
      edge_gross: acc.edge_gross + r.edge_gross,
      edge_cost: acc.edge_cost + r.edge_cost,
      edge_profit: acc.edge_profit + r.edge_profit,
      services_gross: acc.services_gross + r.services_gross,
      total_gross: acc.total_gross + r.total_gross,
      total_cost: acc.total_cost + r.total_cost,
      total_profit: acc.total_profit + r.total_profit
    }), {
      production_days: 0, material_gross: 0, material_cost: 0, material_profit: 0,
      cutting_gross: 0, cutting_cost: 0, cutting_profit: 0,
      edge_gross: 0, edge_cost: 0, edge_profit: 0,
      services_gross: 0, total_gross: 0, total_cost: 0, total_profit: 0
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
          {/* TIER 2A: Bevétel trend + composition                         */}
          {/* ============================================================ */}

          <Paper variant='outlined' sx={{ p: 3, mb: 3 }}>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
              <Box>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>Bevétel trend</Typography>
                <Typography variant='caption' color='text.secondary'>Sorok bruttó összesen — időszak szerint</Typography>
              </Box>
              {seriesTotals && (
                <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCurrency(seriesTotals.lines_gross_total)}
                </Typography>
              )}
            </Stack>

            {hasRevenue ? (
              <ReactApexChart options={revenueTrendOptions} series={revenueTrendSeries} type='area' height={280} />
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
              <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                <Box>
                  <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>Becsült árrés kalkuláció</Typography>
                  <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap>
                    <TextField
                      size='small' type='number' label='Szabás Ft/nap'
                      value={cuttingLaborPerDay} onChange={e => setCuttingLaborPerDay(Number(e.target.value) || 0)}
                      InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                      sx={{ width: 145 }}
                    />
                    <TextField
                      size='small' type='number' label='Élzárás Ft/nap'
                      value={edgeLaborPerDay} onChange={e => setEdgeLaborPerDay(Number(e.target.value) || 0)}
                      InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                      sx={{ width: 145 }}
                    />
                    <TextField
                      size='small' type='number' label='Élzárás anyag Ft/m'
                      value={edgeMaterialPerM} onChange={e => setEdgeMaterialPerM(Number(e.target.value) || 0)}
                      InputProps={{ sx: { fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' } }}
                      sx={{ width: 155 }}
                    />
                    <Typography variant='caption' color='text.secondary'>Anyag: aktuális beszerzési ár</Typography>
                  </Stack>
                </Box>
                {profitTotals.total_gross > 0 && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase' }}>Összes becsült árrés</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums', color: profitTotals.total_profit >= 0 ? 'success.main' : 'error.main' }}>
                      {fmtCurrency(profitTotals.total_profit)}
                      <Typography component='span' sx={{ ml: 0.75, fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>
                        ({fmtPct((profitTotals.total_profit / profitTotals.total_gross) * 100)})
                      </Typography>
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Summary cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
                {([
                  { label: 'Bútórlap', gross: profitTotals.material_gross, cost: profitTotals.material_cost, profit: profitTotals.material_profit, color: C.black },
                  { label: 'Szabás', gross: profitTotals.cutting_gross, cost: profitTotals.cutting_cost, profit: profitTotals.cutting_profit, color: C.orange },
                  { label: 'Élzárás', gross: profitTotals.edge_gross, cost: profitTotals.edge_cost, profit: profitTotals.edge_profit, color: C.teal },
                  { label: 'Szolgáltatások', gross: profitTotals.services_gross, cost: 0, profit: profitTotals.services_gross, color: C.gray }
                ] as const).map(cat => (
                  <Box key={cat.label} sx={{ p: 2, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, borderLeft: `3px solid ${cat.color}` }}>
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase' }}>{cat.label}</Typography>
                    <Stack direction='row' justifyContent='space-between' alignItems='baseline' sx={{ mt: 0.5 }}>
                      <Box>
                        <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.6rem' }}>Bevétel</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(cat.gross)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.6rem' }}>Költség</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{cat.cost > 0 ? fmtCurrency(cat.cost) : '—'}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.6rem' }}>Árrés</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', color: cat.profit >= 0 ? 'success.main' : 'error.main' }}>
                          {fmtCurrency(cat.profit)}
                        </Typography>
                      </Box>
                    </Stack>
                    {cat.gross > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress
                          variant='determinate'
                          value={Math.min(Math.max(cat.cost > 0 ? (cat.profit / cat.gross) * 100 : 100, 0), 100)}
                          sx={{
                            height: 4, borderRadius: 2,
                            bgcolor: theme => alpha(cat.color, 0.08),
                            '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: cat.profit >= 0 ? C.teal : C.red }
                          }}
                        />
                        <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.6rem', mt: 0.25, display: 'block' }}>
                          {cat.cost > 0 ? `${fmtPct((cat.profit / cat.gross) * 100)} margin` : 'Költség nem kalkulált'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Collapsible detailed profit table */}
              <Stack direction='row' alignItems='center' spacing={0.5} sx={{ cursor: 'pointer' }} onClick={() => setShowProfitTable(v => !v)}>
                <IconButton size='small'>{showProfitTable ? <CollapseIcon fontSize='small' /> : <ExpandIcon fontSize='small' />}</IconButton>
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                  {showProfitTable ? 'Részletes tábla elrejtése' : 'Részletes tábla megjelenítése'}
                </Typography>
              </Stack>
              <Collapse in={showProfitTable}>
                <TableContainer component={Box} sx={{ mt: 1, borderRadius: 1, border: theme => `1px solid ${theme.palette.divider}`, overflowX: 'auto' }}>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Időszak</TableCell>
                        <TableCell align='right'>Munkanapok</TableCell>
                        <TableCell align='right'>Anyag bevétel</TableCell>
                        <TableCell align='right'>Anyag költség</TableCell>
                        <TableCell align='right'>Anyag árrés</TableCell>
                        <TableCell align='right'>Szabás bevétel</TableCell>
                        <TableCell align='right'>Szabás költség</TableCell>
                        <TableCell align='right'>Szabás árrés</TableCell>
                        <TableCell align='right'>Élzárás bevétel</TableCell>
                        <TableCell align='right'>Élzárás költség</TableCell>
                        <TableCell align='right'>Élzárás árrés</TableCell>
                        <TableCell align='right'>Szolg.</TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700 }}>Össz. árrés</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profitRows?.map(row => (
                        <TableRow key={row.period}>
                          <TableCell>{fmtPeriodLabel(row.period, granularity)}</TableCell>
                          <TableCell align='right'>{row.production_days}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.material_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.material_cost)}</TableCell>
                          <TableCell align='right' sx={{ color: row.material_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.material_profit)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.cutting_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.cutting_cost)}</TableCell>
                          <TableCell align='right' sx={{ color: row.cutting_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.cutting_profit)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.edge_gross)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.edge_cost)}</TableCell>
                          <TableCell align='right' sx={{ color: row.edge_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.edge_profit)}</TableCell>
                          <TableCell align='right'>{fmtCurrency(row.services_gross)}</TableCell>
                          <TableCell align='right' sx={{ fontWeight: 700, color: row.total_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(row.total_profit)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={totalsRowSx}>
                        <TableCell>Összesen</TableCell>
                        <TableCell align='right'>{profitTotals.production_days}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.material_gross)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.material_cost)}</TableCell>
                        <TableCell align='right' sx={{ color: profitTotals.material_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.material_profit)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.cutting_gross)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.cutting_cost)}</TableCell>
                        <TableCell align='right' sx={{ color: profitTotals.cutting_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.cutting_profit)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.edge_gross)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.edge_cost)}</TableCell>
                        <TableCell align='right' sx={{ color: profitTotals.edge_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.edge_profit)}</TableCell>
                        <TableCell align='right'>{fmtCurrency(profitTotals.services_gross)}</TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, color: profitTotals.total_profit >= 0 ? 'success.main' : 'error.main' }}>{fmtCurrency(profitTotals.total_profit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
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

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Breadcrumbs,
  Link,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Divider
} from '@mui/material'
import {
  Home as HomeIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  Receipt as ReceiptIcon,
  Category as CategoryIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  SwapHoriz as ConversionIcon
} from '@mui/icons-material'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
}

interface Summary {
  total_quotes: number
  total_orders: number
  total_revenue: number
  avg_order_value: number
  first_order_date: string | null
  last_order_date: string | null
  days_since_last: number
  draft_value: number
  status_draft: number
  status_accepted: number
  status_ordered: number
  status_in_production: number
  status_ready: number
  status_done: number
  status_finished: number
  cancelled_count: number
}

interface MonthlyRevenue {
  month: string
  revenue: number
  order_count: number
}

interface Breakdown {
  material_gross: number
  cutting_gross: number
  edge_materials_gross: number
  services_gross: number
  fees_gross: number
  accessories_gross: number
  cutting_length_m: number
  tabla_m2: number
  edge_length_m: number
}

interface TopMaterial {
  material_id: string
  material_name: string
  thickness_mm: number
  material_gross: number
  tabla_m2: number
  quote_count: number
}

interface RecentOrder {
  quote_id: string
  quote_number: string
  order_number: string | null
  production_date: string | null
  created_at: string | null
  status: string
  total_gross: number
  payment_status: string
}

interface StatsData {
  summary: Summary | null
  monthly: MonthlyRevenue[]
  breakdown: Breakdown | null
  topMaterials: TopMaterial[]
  recentOrders: RecentOrder[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtNum = (v: number) => Math.round(v).toLocaleString('hu-HU')
const fmtCurrency = (v: number) => `${fmtNum(v)} Ft`
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const STATUS_MAP: Record<string, { label: string; color: 'default' | 'primary' | 'info' | 'warning' | 'success' | 'error' | 'secondary' }> = {
  draft: { label: 'Piszkozat', color: 'default' },
  accepted: { label: 'Elfogadva', color: 'default' },
  ordered: { label: 'Megrendelve', color: 'info' },
  in_production: { label: 'Gyártásban', color: 'warning' },
  ready: { label: 'Kész', color: 'success' },
  done: { label: 'Elkészült', color: 'success' },
  finished: { label: 'Átadva', color: 'primary' },
  cancelled: { label: 'Törölve', color: 'error' }
}

const PAYMENT_MAP: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  paid: { label: 'Fizetve', color: 'success' },
  partially_paid: { label: 'Részben', color: 'warning' },
  not_paid: { label: 'Nincs fizetve', color: 'error' }
}

const BREAKDOWN_ITEMS: { key: keyof Breakdown; label: string; color: string }[] = [
  { key: 'material_gross', label: 'Anyag', color: '#0B6E99' },
  { key: 'cutting_gross', label: 'Szabás', color: '#D9730D' },
  { key: 'edge_materials_gross', label: 'Élzárás', color: '#0F7B6C' },
  { key: 'services_gross', label: 'Szolgáltatás', color: '#9B59B6' },
  { key: 'fees_gross', label: 'Díjak', color: '#E03E3E' },
  { key: 'accessories_gross', label: 'Kiegészítők', color: '#2979FF' }
]

const STATUS_FUNNEL: { key: keyof Summary; label: string; color: string }[] = [
  { key: 'status_draft', label: 'Piszkozat', color: '#9B9A97' },
  { key: 'status_accepted', label: 'Elfogadva', color: '#000' },
  { key: 'status_ordered', label: 'Megrendelve', color: '#2979FF' },
  { key: 'status_in_production', label: 'Gyártásban', color: '#D9730D' },
  { key: 'status_ready', label: 'Kész', color: '#0F7B6C' },
  { key: 'status_done', label: 'Elkészült', color: '#0F7B6C' },
  { key: 'status_finished', label: 'Átadva', color: '#0B6E99' },
  { key: 'cancelled_count', label: 'Törölve', color: '#E03E3E' }
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerDashboardClient({ customer }: { customer: Customer }) {
  const router = useRouter()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${customer.id}/stats`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customer.id])

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  const s = data?.summary
  const bd = data?.breakdown
  const bdTotal = bd
    ? bd.material_gross + bd.cutting_gross + bd.edge_materials_gross + bd.services_gross + bd.fees_gross + bd.accessories_gross
    : 0

  const maxMonthly = data?.monthly?.length
    ? Math.max(...data.monthly.map(m => m.revenue))
    : 0

  const matMax = data?.topMaterials?.length
    ? Math.max(...data.topMaterials.map(m => m.material_gross))
    : 0

  const conversionRate = s && s.total_quotes > 0
    ? Math.round((s.total_orders / s.total_quotes) * 100)
    : 0

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label='breadcrumb' sx={{ mb: 3 }}>
        <Link href='/' underline='hover' color='inherit' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize='small' />
          Főoldal
        </Link>
        <Link href='/favourite' underline='hover' color='inherit'>
          Asztalosok
        </Link>
        <Typography color='text.primary'>{customer.name}</Typography>
      </Breadcrumbs>

      {/* Customer header */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant='h4' fontWeight={500} sx={{ mb: 1 }}>
              {customer.name}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
              {customer.mobile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <PhoneIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant='body2' color='text.secondary'>{customer.mobile}</Typography>
                </Box>
              )}
              {customer.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <EmailIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant='body2' color='text.secondary'>{customer.email}</Typography>
                </Box>
              )}
              {customer.discount_percent > 0 && (
                <Chip label={`${customer.discount_percent}% kedvezmény`} size='small' color='success' variant='outlined' />
              )}
            </Box>
          </Box>
          {s && (
            <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant='body2' color='text.secondary'>Összesített bevétel</Typography>
              <Typography variant='h4' fontWeight={600}>{fmtCurrency(s.total_revenue)}</Typography>
              {s.first_order_date && (
                <Typography variant='caption' color='text.disabled'>
                  Ügyfél óta: {fmtDate(s.first_order_date)}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* KPI cards — 4 columns */}
      {s && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <ReceiptIcon sx={{ fontSize: 20, color: '#0B6E99' }} />
                <Typography variant='body2' color='text.secondary'>Rendelések</Typography>
              </Box>
              <Typography variant='h5' fontWeight={600}>{fmtNum(s.total_orders)}</Typography>
              <Typography variant='caption' color='text.disabled'>
                összesen {fmtNum(s.total_quotes)} ajánlat
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <TrendingUpIcon sx={{ fontSize: 20, color: '#0F7B6C' }} />
                <Typography variant='body2' color='text.secondary'>Átlag rendelés érték</Typography>
              </Box>
              <Typography variant='h5' fontWeight={600}>{fmtCurrency(s.avg_order_value)}</Typography>
              <Typography variant='caption' color='text.disabled'>
                bruttó / rendelés
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CalendarIcon sx={{ fontSize: 20, color: '#D9730D' }} />
                <Typography variant='body2' color='text.secondary'>Utolsó rendelés</Typography>
              </Box>
              <Typography variant='h5' fontWeight={600}>{fmtDate(s.last_order_date)}</Typography>
              <Typography variant='caption' color='text.disabled'>
                {s.days_since_last > 0 ? `${s.days_since_last} napja` : 'Ma'}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <ConversionIcon sx={{ fontSize: 20, color: '#9B59B6' }} />
                <Typography variant='body2' color='text.secondary'>Konverzió</Typography>
              </Box>
              <Typography variant='h5' fontWeight={600}>{conversionRate}%</Typography>
              <Typography variant='caption' color='text.disabled'>
                ajánlatból rendelés
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Status funnel */}
      {s && s.total_quotes > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant='h6' sx={{ mb: 2 }}>Státusz megoszlás</Typography>

            {/* Visual bar */}
            <Box sx={{ display: 'flex', height: 32, borderRadius: 1, overflow: 'hidden', mb: 2 }}>
              {STATUS_FUNNEL.map(item => {
                const val = s[item.key] as number
                if (val <= 0) return null
                const pct = (val / s.total_quotes) * 100
                return (
                  <Box
                    key={item.key}
                    sx={{ width: `${pct}%`, bgcolor: item.color, minWidth: pct > 0 ? 2 : 0, transition: 'width 0.3s' }}
                  />
                )
              })}
            </Box>

            {/* Legend chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {STATUS_FUNNEL.map(item => {
                const val = s[item.key] as number
                if (val <= 0) return null
                const pct = ((val / s.total_quotes) * 100).toFixed(0)
                return (
                  <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                    <Typography variant='body2'>
                      {item.label}
                    </Typography>
                    <Typography variant='body2' fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {val}
                    </Typography>
                    <Typography variant='caption' color='text.disabled'>
                      ({pct}%)
                    </Typography>
                  </Box>
                )
              })}
            </Box>

            {/* Draft value callout */}
            {s.draft_value > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#9B9A97' }} />
                  <Typography variant='body2' color='text.secondary'>
                    Piszkozatokban lévő érték:
                  </Typography>
                  <Typography variant='body2' fontWeight={600}>
                    {fmtCurrency(s.draft_value)}
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revenue trend + breakdown side by side */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {/* Monthly trend */}
        <Card>
          <CardContent>
            <Typography variant='h6' sx={{ mb: 2 }}>Havi bevétel (utolsó 12 hó)</Typography>
            {data?.monthly && data.monthly.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {data.monthly.map(m => {
                  const pct = maxMonthly > 0 ? (m.revenue / maxMonthly) * 100 : 0
                  const label = new Date(m.month).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
                  return (
                    <Box key={m.month} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant='caption' color='text.secondary' sx={{ minWidth: 75, fontVariantNumeric: 'tabular-nums' }}>
                        {label}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress
                          variant='determinate'
                          value={pct}
                          sx={{
                            height: 18,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { bgcolor: '#0B6E99', borderRadius: 1 }
                          }}
                        />
                      </Box>
                      <Typography variant='caption' sx={{ minWidth: 85, textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtCurrency(m.revenue)}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            ) : (
              <Typography variant='body2' color='text.disabled'>Nincs adat</Typography>
            )}
          </CardContent>
        </Card>

        {/* Revenue breakdown */}
        <Card>
          <CardContent>
            <Typography variant='h6' sx={{ mb: 2 }}>Bevétel összetétel</Typography>
            {bd && bdTotal > 0 ? (
              <>
                {/* Stacked bar */}
                <Box sx={{ display: 'flex', height: 28, borderRadius: 1, overflow: 'hidden', mb: 2.5 }}>
                  {BREAKDOWN_ITEMS.map(item => {
                    const val = bd[item.key] as number
                    if (val <= 0) return null
                    const pct = (val / bdTotal) * 100
                    return (
                      <Box
                        key={item.key}
                        sx={{ width: `${pct}%`, bgcolor: item.color, minWidth: pct > 0 ? 2 : 0, transition: 'width 0.3s' }}
                      />
                    )
                  })}
                </Box>

                {/* Legend rows */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {BREAKDOWN_ITEMS.map(item => {
                    const val = bd[item.key] as number
                    if (val <= 0) return null
                    const pct = ((val / bdTotal) * 100).toFixed(1)
                    return (
                      <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                          <Typography variant='body2'>{item.label}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant='body2' color='text.secondary' sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {pct}%
                          </Typography>
                          <Typography variant='body2' fontWeight={500} sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>
                            {fmtCurrency(val)}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>

                {/* Volume metrics */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant='caption' color='text.disabled'>Tábla m²</Typography>
                    <Typography variant='body2' fontWeight={500}>{bd.tabla_m2.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m²</Typography>
                  </Box>
                  <Box>
                    <Typography variant='caption' color='text.disabled'>Szabás</Typography>
                    <Typography variant='body2' fontWeight={500}>{bd.cutting_length_m.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m</Typography>
                  </Box>
                  <Box>
                    <Typography variant='caption' color='text.disabled'>Élzárás</Typography>
                    <Typography variant='body2' fontWeight={500}>{bd.edge_length_m.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <Typography variant='body2' color='text.disabled'>Nincs adat</Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Top materials — full width */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CategoryIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            <Typography variant='h6'>Top anyagok</Typography>
          </Box>
          {data?.topMaterials && data.topMaterials.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {data.topMaterials.map((mat, idx) => {
                const pct = matMax > 0 ? (mat.material_gross / matMax) * 100 : 0
                return (
                  <Box key={mat.material_id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.25 }}>
                      <Typography variant='body2' fontWeight={600}>
                        <Typography component='span' variant='caption' color='text.secondary' sx={{ mr: 0.75, fontWeight: 700 }}>
                          {idx + 1}.
                        </Typography>
                        {mat.material_name}
                        <Typography component='span' variant='caption' color='text.disabled' sx={{ ml: 0.5 }}>
                          {mat.thickness_mm}mm
                        </Typography>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
                        <Typography variant='caption' color='text.disabled'>
                          {mat.tabla_m2.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m²
                        </Typography>
                        <Typography variant='caption' color='text.disabled'>
                          {mat.quote_count} rendelés
                        </Typography>
                        <Typography variant='body2' fontWeight={500} sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
                          {fmtCurrency(mat.material_gross)}
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant='determinate'
                      value={pct}
                      sx={{
                        height: 6,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: '#0B6E99', borderRadius: 1 }
                      }}
                    />
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography variant='body2' color='text.disabled'>Nincs anyag adat</Typography>
          )}
        </CardContent>
      </Card>

      {/* Recent orders — full width */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ReceiptIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            <Typography variant='h6'>Összes ajánlat</Typography>
            {data?.recentOrders && (
              <Typography variant='caption' color='text.disabled' sx={{ ml: 'auto' }}>
                {data.recentOrders.length} tétel
              </Typography>
            )}
          </Box>
          {data?.recentOrders && data.recentOrders.length > 0 ? (
            <TableContainer component={Paper} elevation={0}>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Létrehozva</TableCell>
                    <TableCell>Gyártás</TableCell>
                    <TableCell>Szám</TableCell>
                    <TableCell>Státusz</TableCell>
                    <TableCell align='right'>Összeg</TableCell>
                    <TableCell>Fizetés</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recentOrders.map(order => {
                    const st = STATUS_MAP[order.status] || { label: order.status, color: 'default' as const }
                    const pay = PAYMENT_MAP[order.payment_status] || { label: order.payment_status, color: 'default' as const }
                    return (
                      <TableRow
                        key={order.quote_id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/quotes/${order.quote_id}`)}
                      >
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fmtDate(order.created_at)}
                        </TableCell>
                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: order.production_date ? 'text.primary' : 'text.disabled' }}>
                          {fmtDate(order.production_date)}
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2' sx={{ fontWeight: 500, whiteSpace: 'nowrap', color: 'info.main' }}>
                            {order.order_number || order.quote_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={st.label} size='small' color={st.color} variant='outlined' />
                        </TableCell>
                        <TableCell align='right' sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                          {fmtCurrency(order.total_gross)}
                        </TableCell>
                        <TableCell>
                          <Chip label={pay.label} size='small' color={pay.color} variant='outlined' />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant='body2' color='text.disabled'>Nincs ajánlat</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

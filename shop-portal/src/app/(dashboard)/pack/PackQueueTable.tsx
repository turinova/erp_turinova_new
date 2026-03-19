'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Typography,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material'
import {
  OpenInNew as OpenIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Inventory2 as Inventory2Icon,
  Visibility as VisibilityIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'

const RECENT_PACKED_HOURS = 48

interface PackOrder {
  id: string
  order_number: string
  status: string
  customer_email: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_city: string | null
  shipping_postcode: string | null
  shipping_address1: string | null
  shipping_method_name: string | null
  order_date: string | null
  updated_at: string
  item_count: number
}

const PACK_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  picked: { label: 'Kiszedve', color: '#ffffff', bgColor: '#78909c' },
  packing: { label: 'Csomagolás alatt', color: '#ffffff', bgColor: '#1565c0' },
  awaiting_carrier: { label: 'Futárra vár', color: '#ffffff', bgColor: '#ef6c00' },
  ready_for_pickup: { label: 'Átvételre kész', color: '#ffffff', bgColor: '#2e7d32' }
}

const ROW_BG: Record<string, string> = {
  picked: '#ECEFF1',
  packing: '#E3F2FD',
  awaiting_carrier: '#FFF3E0',
  ready_for_pickup: '#E8F5E9'
}

function PackStatusChip({ status }: { status: string }) {
  const config = PACK_STATUS_CONFIG[status] || { label: status, color: '#ffffff', bgColor: '#757575' }
  return (
    <Chip
      label={config.label}
      size="small"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24
      }}
    />
  )
}

type ViewMode = 'queue' | 'recent'

export default function PackQueueTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialView: ViewMode = searchParams.get('view') === 'recent' ? 'recent' : 'queue'

  const [viewMode, setViewMode] = useState<ViewMode>(initialView)
  const [orders, setOrders] = useState<PackOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const debouncedSearch = useDebounce(searchTerm, 500)
  const initialStatus = searchParams.get('status') || 'all'
  const [statusFilter, setStatusFilter] = useState(
    ['all', 'picked', 'packing'].includes(initialStatus) ? initialStatus : 'all'
  )
  const [shippingFilter, setShippingFilter] = useState(searchParams.get('shipping') || '')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const scope = viewMode === 'recent' ? 'recent_packed' : 'queue'
      const res = await fetch(`/api/pack/orders?scope=${scope}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a lista betöltésekor')
    } finally {
      setLoading(false)
    }
  }, [viewMode])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    const params = new URLSearchParams()
    if (viewMode === 'recent') params.set('view', 'recent')
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (viewMode === 'queue' && statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    if (shippingFilter) params.set('shipping', shippingFilter)
    const q = params.toString()
    router.replace(q ? `/pack?${q}` : '/pack', { scroll: false })
  }, [viewMode, debouncedSearch, statusFilter, shippingFilter, router])

  const shippingOptions = useMemo(() => {
    const names = new Set<string>()
    orders.forEach((o) => {
      if (o.shipping_method_name?.trim()) names.add(o.shipping_method_name.trim())
    })
    return [...names].sort((a, b) => a.localeCompare(b, 'hu'))
  }, [orders])

  const filteredOrders = useMemo(() => {
    let list = orders
    if (viewMode === 'queue') {
      if (statusFilter === 'picked') list = list.filter((o) => o.status === 'picked')
      else if (statusFilter === 'packing') list = list.filter((o) => o.status === 'packing')
    }
    if (shippingFilter) list = list.filter((o) => (o.shipping_method_name || '').trim() === shippingFilter)
    if (!debouncedSearch.trim()) return list
    const q = debouncedSearch.trim().toLowerCase()
    return list.filter(
      (o) =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q) ||
        (o.shipping_firstname || '').toLowerCase().includes(q) ||
        (o.shipping_lastname || '').toLowerCase().includes(q) ||
        (o.shipping_company || '').toLowerCase().includes(q) ||
        (o.shipping_city || '').toLowerCase().includes(q) ||
        (o.shipping_postcode || '').toLowerCase().includes(q) ||
        (o.shipping_address1 || '').toLowerCase().includes(q) ||
        (o.shipping_method_name || '').toLowerCase().includes(q)
    )
  }, [orders, viewMode, statusFilter, shippingFilter, debouncedSearch])

  const pickedCount = useMemo(() => orders.filter((o) => o.status === 'picked').length, [orders])
  const packingCount = useMemo(() => orders.filter((o) => o.status === 'packing').length, [orders])

  const hasActiveFilters =
    !!debouncedSearch ||
    (viewMode === 'queue' && statusFilter && statusFilter !== 'all') ||
    !!shippingFilter

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setShippingFilter('')
    const params = new URLSearchParams()
    if (viewMode === 'recent') params.set('view', 'recent')
    router.replace(params.toString() ? `/pack?${params.toString()}` : '/pack', { scroll: false })
  }

  const handleViewChange = (_: React.SyntheticEvent, value: ViewMode) => {
    setViewMode(value)
    if (value === 'recent') {
      setStatusFilter('all')
    }
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–'

  const colCount = 8

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Csomagolás
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {viewMode === 'queue'
            ? 'A fő nézet a teendők: kiszedve vagy csomagolás alatt lévő rendelések. Nyisd meg a csomagolást, szkenneld a tételeket, majd zárd le.'
            : `Itt csak a közelmúltban lezárt csomagolások látszanak (utolsó ${RECENT_PACKED_HOURS} óra): futárra váró vagy átvételre kész rendelések. Ellenőrzéshez, nem újracsomagoláshoz.`}
        </Typography>

        <Tabs
          value={viewMode}
          onChange={handleViewChange}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Csomagolásra vár" value="queue" />
          <Tab label="Legutóbb csomagolva" value="recent" />
        </Tabs>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {viewMode === 'queue' && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Állapot</InputLabel>
            <Select
              value={statusFilter}
              label="Állapot"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Összes</MenuItem>
              <MenuItem value="picked">Kiszedve</MenuItem>
              <MenuItem value="packing">Csomagolás alatt</MenuItem>
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 220 }} disabled={shippingOptions.length === 0}>
          <InputLabel>Szállítási mód</InputLabel>
          <Select
            value={shippingFilter}
            label="Szállítási mód"
            onChange={(e) => setShippingFilter(e.target.value)}
          >
            <MenuItem value="">Összes</MenuItem>
            {shippingOptions.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          placeholder="Keresés: rendelésszám, név, cím, e-mail, szállítás…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 280, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        {hasActiveFilters && (
          <Button size="small" onClick={handleClearFilters} startIcon={<ClearIcon />}>
            Szűrők törlése
          </Button>
        )}
      </Box>

      {!loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {viewMode === 'queue' ? (
            <>
              Összesen <strong>{orders.length}</strong> rendelés a sorban
              {orders.length > 0 && (
                <>
                  {' '}
                  · <strong>{pickedCount}</strong> kiszedve, <strong>{packingCount}</strong> csomagolás alatt
                </>
              )}
            </>
          ) : (
            <>
              <strong>{orders.length}</strong> rendelés az elmúlt <strong>{RECENT_PACKED_HOURS}</strong> órában (csomagolás lezárva)
            </>
          )}
        </Typography>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rendelésszám</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Állapot</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Tételek</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rendelés dátuma</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Frissítve</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Átvevő / Cím</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Szállítási mód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right', minWidth: 130 }}>Művelet</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Inventory2Icon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {viewMode === 'queue'
                        ? 'Nincs csomagolásra váró rendelés. A kiszedett rendelések jelennek meg itt, miután a begyűjtés / szedés kész.'
                        : `Nincs megjeleníthető rendelés az elmúlt ${RECENT_PACKED_HOURS} órában. A lezárt csomagolások (futárra vár / átvételre kész) itt kereshetők vissza.`}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    Nincs találat a szűrőknek megfelelően.
                  </Typography>
                  <Button size="small" onClick={handleClearFilters}>
                    Szűrők törlése
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow
                  key={order.id}
                  hover
                  sx={{
                    '& td': { py: 1 },
                    backgroundColor: ROW_BG[order.status] || '#FAFAFA',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{order.order_number}</Typography>
                  </TableCell>
                  <TableCell>
                    <PackStatusChip status={order.status} />
                  </TableCell>
                  <TableCell align="right">{order.item_count ?? 0}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{formatDate(order.updated_at)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') ||
                        order.shipping_company ||
                        '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {[order.shipping_city, order.shipping_postcode, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{order.shipping_method_name || '—'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {viewMode === 'queue' ? (
                      <Button
                        component={NextLink}
                        href={`/pack/orders/${order.id}`}
                        variant="contained"
                        size="small"
                        endIcon={<OpenIcon />}
                      >
                        Csomagolás
                      </Button>
                    ) : (
                      <Button
                        component={NextLink}
                        href={`/orders/${order.id}`}
                        variant="outlined"
                        size="small"
                        endIcon={<VisibilityIcon />}
                      >
                        Megtekintés
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

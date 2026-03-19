'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import NextLink from 'next/link'
import {
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Button,
  CircularProgress,
  Typography,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip
} from '@mui/material'
import {
  Search as SearchIcon,
  LocalShipping as ShippedIcon,
  CheckCircle as DeliveredIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

const RECENT_HOURS = 48

type MainTab = 'carrier' | 'pickup'
type SubView = 'queue' | 'recent'

interface CarrierOrder {
  id: string
  order_number: string
  status: string
  tracking_number: string | null
  customer_email: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_city: string | null
  shipping_address1: string | null
  shipping_method_name: string | null
  order_date: string | null
  shipped_at: string | null
  updated_at: string
}

interface PickupOrder {
  id: string
  order_number: string
  status: string
  customer_email: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_city: string | null
  shipping_address1: string | null
  updated_at: string
}

const STATUS_CHIP: Record<string, { label: string; bg: string }> = {
  awaiting_carrier: { label: 'Futárra vár', bg: '#ef6c00' },
  shipped: { label: 'Elküldve', bg: '#2e7d32' },
  ready_for_pickup: { label: 'Átvételre kész', bg: '#1565c0' },
  delivered: { label: 'Átvéve', bg: '#2e7d32' }
}

function StatusChip({ status }: { status: string }) {
  const c = STATUS_CHIP[status] || { label: status, bg: '#757575' }
  return (
    <Chip
      label={c.label}
      size="small"
      sx={{ bgcolor: c.bg, color: '#fff', fontWeight: 600, fontSize: '0.75rem', height: 24 }}
    />
  )
}

export default function DispatchTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialMain: MainTab = searchParams.get('tab') === 'pickup' ? 'pickup' : 'carrier'
  const initialSub: SubView = searchParams.get('view') === 'recent' ? 'recent' : 'queue'

  const [mainTab, setMainTab] = useState<MainTab>(initialMain)
  const [subView, setSubView] = useState<SubView>(initialSub)

  const [carrierOrders, setCarrierOrders] = useState<CarrierOrder[]>([])
  const [pickupOrders, setPickupOrders] = useState<PickupOrder[]>([])
  const [carrierLoading, setCarrierLoading] = useState(false)
  const [pickupLoading, setPickupLoading] = useState(false)

  const [carrierSearch, setCarrierSearch] = useState(searchParams.get('cq') || '')
  const [pickupSearch, setPickupSearch] = useState(searchParams.get('pq') || '')
  const debouncedCarrierSearch = useDebounce(carrierSearch, 400)
  const debouncedPickupSearch = useDebounce(pickupSearch, 400)

  const [carrierSelected, setCarrierSelected] = useState<Set<string>>(new Set())
  const [pickupSelected, setPickupSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState<'carrier' | 'pickup' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCarrier = useCallback(async () => {
    setCarrierLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', subView === 'recent' ? 'recent_shipped' : 'queue')
      const q = debouncedCarrierSearch.trim()
      if (q) params.set('q', q)
      const res = await fetch(`/api/dispatch/carrier?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCarrierOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a futárnak átadandók listáján')
    } finally {
      setCarrierLoading(false)
    }
  }, [subView, debouncedCarrierSearch])

  const fetchPickup = useCallback(async () => {
    setPickupLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', subView === 'recent' ? 'recent_delivered' : 'queue')
      const q = debouncedPickupSearch.trim()
      if (q) params.set('q', q)
      const res = await fetch(`/api/dispatch/pickup?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPickupOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a személyes átvételek listáján')
    } finally {
      setPickupLoading(false)
    }
  }, [subView, debouncedPickupSearch])

  useEffect(() => {
    if (mainTab !== 'carrier') return
    fetchCarrier()
  }, [mainTab, fetchCarrier])

  useEffect(() => {
    if (mainTab !== 'pickup') return
    fetchPickup()
  }, [mainTab, fetchPickup])

  useEffect(() => {
    setCarrierSelected(new Set())
    setPickupSelected(new Set())
  }, [subView, debouncedCarrierSearch, debouncedPickupSearch, mainTab])

  useEffect(() => {
    const params = new URLSearchParams()
    if (mainTab === 'pickup') params.set('tab', 'pickup')
    if (subView === 'recent') params.set('view', 'recent')
    if (debouncedCarrierSearch.trim()) params.set('cq', debouncedCarrierSearch.trim())
    if (debouncedPickupSearch.trim()) params.set('pq', debouncedPickupSearch.trim())
    const q = params.toString()
    router.replace(q ? `/dispatch?${q}` : '/dispatch', { scroll: false })
  }, [mainTab, subView, debouncedCarrierSearch, debouncedPickupSearch, router])

  const handleSubViewChange = (_: React.SyntheticEvent, v: SubView) => {
    setSubView(v)
  }

  const carrierQueueMode = mainTab === 'carrier' && subView === 'queue'
  const pickupQueueMode = mainTab === 'pickup' && subView === 'queue'

  const carrierAllChecked = carrierOrders.length > 0 && carrierSelected.size === carrierOrders.length
  const carrierSomeChecked = carrierSelected.size > 0
  const handleCarrierSelectAll = (checked: boolean) => {
    if (checked) setCarrierSelected(new Set(carrierOrders.map((o) => o.id)))
    else setCarrierSelected(new Set())
  }
  const handleCarrierToggle = (id: string) => {
    const next = new Set(carrierSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCarrierSelected(next)
  }

  const pickupAllChecked = pickupOrders.length > 0 && pickupSelected.size === pickupOrders.length
  const pickupSomeChecked = pickupSelected.size > 0
  const handlePickupSelectAll = (checked: boolean) => {
    if (checked) setPickupSelected(new Set(pickupOrders.map((o) => o.id)))
    else setPickupSelected(new Set())
  }
  const handlePickupToggle = (id: string) => {
    const next = new Set(pickupSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPickupSelected(next)
  }

  const handleConfirmCarrier = () => setConfirmOpen('carrier')
  const handleConfirmPickup = () => setConfirmOpen('pickup')
  const handleCloseConfirm = () => {
    if (!actionLoading) setConfirmOpen(null)
  }

  const handleMarkShipped = async () => {
    const ids = Array.from(carrierSelected)
    if (ids.length === 0) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/dispatch/carrier/mark-shipped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: ids })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const updated = (data.updated || []) as string[]
      const already = (data.already_shipped || []) as string[]
      setCarrierSelected(new Set())
      await fetchCarrier()
      setConfirmOpen(null)
      if (updated.length) toast.success(`${updated.length} rendelés átadva a futárnak.`)
      if (already.length) toast.info(`${already.length} már korábban átadva.`)
    } catch (e) {
      console.error(e)
      toast.error('Hiba az átadás rögzítésekor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkDelivered = async () => {
    const ids = Array.from(pickupSelected)
    if (ids.length === 0) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/dispatch/pickup/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: ids })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const updated = (data.updated || []) as string[]
      const already = (data.already_delivered || []) as string[]
      setPickupSelected(new Set())
      await fetchPickup()
      setConfirmOpen(null)
      if (updated.length) toast.success(`${updated.length} rendelés átvéve.`)
      if (already.length) toast.info(`${already.length} már korábban átvéve.`)
    } catch (e) {
      console.error(e)
      toast.error('Hiba az átvétel rögzítésekor')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('hu-HU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '–'

  const subtitle = useMemo(() => {
    if (mainTab === 'carrier') {
      return subView === 'queue'
        ? 'A csomagolás után „futárra vár” állapotú rendelések listája. Ellenőrizd a címkét / csomagot, jelöld ki, majd rögzítsd: átadtad a futárszolgálatnak. Az állapot **Elküldve** lesz, és rögzítjük az időpontot.'
        : `Csak ellenőrzéshez: az elmúlt **${RECENT_HOURS} órában** futárnak átadott (Elküldve) rendelések. Itt nem lehet státuszt módosítani — részletek a rendelés oldalon.`
    }
    return subView === 'queue'
      ? 'A vevő személyesen jön érte: „átvételre kész” rendelések. Keresés név / rendelésszám alapján, majd jelöld **Átvéve**, ha átvette a csomagot. Az állapot **Átvéve (teljesítve)** lesz.'
      : `Csak ellenőrzéshez: az elmúlt **${RECENT_HOURS} órában** személyesen átvett rendelések. Itt nem lehet státuszt módosítani — részletek a rendelés oldalon.`
  }, [mainTab, subView])

  const carrierEmptyMessage = () => {
    if (debouncedCarrierSearch.trim()) return 'Nincs találat a keresésre.'
    if (subView === 'recent')
      return `Nincs megjeleníthető rendelés az elmúlt ${RECENT_HOURS} órában (Elküldve).`
    return 'Nincs futárnak átadandó rendelés. A csomagolás lezárása után, „futárra vár” állapotban jelennek meg itt.'
  }

  const pickupEmptyMessage = () => {
    if (debouncedPickupSearch.trim()) return 'Nincs találat a keresésre.'
    if (subView === 'recent')
      return `Nincs megjeleníthető rendelés az elmúlt ${RECENT_HOURS} órában (átvéve).`
    return 'Nincs személyes átvételre váró rendelés. A csomagolás után „átvételre kész” állapotban jelennek meg itt.'
  }

  const tabIndex = mainTab === 'carrier' ? 0 : 1

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
        {subtitle.split('**').map((part, i) =>
          i % 2 === 1 ? (
            <strong key={i}>{part}</strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </Typography>

      <Tabs
        value={tabIndex}
        onChange={(_, v) => setMainTab(v === 0 ? 'carrier' : 'pickup')}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Futárnak átadandók" id="dispatch-tab-0" aria-controls="dispatch-panel-0" />
        <Tab label="Személyes átvételek" id="dispatch-tab-1" aria-controls="dispatch-panel-1" />
      </Tabs>

      <Tabs
        value={subView}
        onChange={handleSubViewChange}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Teendők" value="queue" />
        <Tab
          label={mainTab === 'carrier' ? 'Legutóbb futárnak átadva' : 'Legutóbb átvéve'}
          value="recent"
        />
      </Tabs>

      {/* Carrier */}
      <Box role="tabpanel" hidden={mainTab !== 'carrier'} id="dispatch-panel-0" aria-labelledby="dispatch-tab-0">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Keresés: rendelésszám, név, e-mail, követési szám, szállítás…"
            value={carrierSearch}
            onChange={(e) => setCarrierSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 280, flexGrow: 1 }}
          />
          {carrierQueueMode && (
            <Button
              variant="contained"
              startIcon={<ShippedIcon />}
              disabled={!carrierSomeChecked}
              onClick={handleConfirmCarrier}
            >
              Átadva ({carrierSelected.size})
            </Button>
          )}
        </Box>

        {!carrierLoading && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subView === 'queue' ? (
              <>
                <strong>{carrierOrders.length}</strong> rendelés a sorban (futárra vár)
              </>
            ) : (
              <>
                <strong>{carrierOrders.length}</strong> rendelés az elmúlt <strong>{RECENT_HOURS}</strong> órában
                (Elküldve)
              </>
            )}
          </Typography>
        )}

        {carrierLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : carrierOrders.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography color="text.secondary">{carrierEmptyMessage()}</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  {carrierQueueMode && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={carrierSomeChecked && !carrierAllChecked}
                        checked={carrierAllChecked}
                        onChange={(_, c) => handleCarrierSelectAll(c)}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>Rendelésszám</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Állapot</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Átvevő / Cím</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Követés</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Szállítási mód</TableCell>
                  {subView === 'recent' ? (
                    <TableCell sx={{ fontWeight: 600 }}>Átadva (futár)</TableCell>
                  ) : (
                    <TableCell sx={{ fontWeight: 600 }}>Frissítve</TableCell>
                  )}
                  <TableCell align="right" sx={{ fontWeight: 600, minWidth: 120 }}>
                    Művelet
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {carrierOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    {carrierQueueMode && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={carrierSelected.has(order.id)}
                          onChange={() => handleCarrierToggle(order.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography fontWeight={600}>{order.order_number}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={order.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') ||
                          order.shipping_company ||
                          '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {[order.shipping_city, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {order.tracking_number?.trim() || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.shipping_method_name || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      {subView === 'recent'
                        ? formatDt(order.shipped_at || order.updated_at)
                        : formatDt(order.updated_at)}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        component={NextLink}
                        href={`/orders/${order.id}`}
                        variant={carrierQueueMode ? 'outlined' : 'contained'}
                        color={carrierQueueMode ? 'inherit' : 'primary'}
                        size="small"
                        endIcon={<VisibilityIcon />}
                      >
                        Megtekintés
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Pickup */}
      <Box role="tabpanel" hidden={mainTab !== 'pickup'} id="dispatch-panel-1" aria-labelledby="dispatch-tab-1">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Keresés: rendelésszám, név, cég, e-mail…"
            value={pickupSearch}
            onChange={(e) => setPickupSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPickup()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ minWidth: 280, flexGrow: 1 }}
          />
          {pickupQueueMode && (
            <Button
              variant="contained"
              startIcon={<DeliveredIcon />}
              disabled={!pickupSomeChecked}
              onClick={handleConfirmPickup}
            >
              Átvéve ({pickupSelected.size})
            </Button>
          )}
        </Box>

        {!pickupLoading && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subView === 'queue' ? (
              <>
                <strong>{pickupOrders.length}</strong> rendelés átvételre vár
              </>
            ) : (
              <>
                <strong>{pickupOrders.length}</strong> rendelés az elmúlt <strong>{RECENT_HOURS}</strong> órában
                (átvéve)
              </>
            )}
          </Typography>
        )}

        {pickupLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : pickupOrders.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography color="text.secondary">{pickupEmptyMessage()}</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  {pickupQueueMode && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={pickupSomeChecked && !pickupAllChecked}
                        checked={pickupAllChecked}
                        onChange={(_, c) => handlePickupSelectAll(c)}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>Rendelésszám</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Állapot</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Átvevő / Cím</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Frissítve</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, minWidth: 120 }}>
                    Művelet
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pickupOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    {pickupQueueMode && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={pickupSelected.has(order.id)}
                          onChange={() => handlePickupToggle(order.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography fontWeight={600}>{order.order_number}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={order.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') ||
                          order.shipping_company ||
                          order.customer_email ||
                          '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {[order.shipping_city, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDt(order.updated_at)}</TableCell>
                    <TableCell align="right">
                      <Button
                        component={NextLink}
                        href={`/orders/${order.id}`}
                        variant={pickupQueueMode ? 'outlined' : 'contained'}
                        color={pickupQueueMode ? 'inherit' : 'primary'}
                        size="small"
                        endIcon={<VisibilityIcon />}
                      >
                        Megtekintés
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={confirmOpen === 'carrier'} onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Átadva a futárnak</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {carrierSelected.size} rendelés megjelölése átadottként? A rendelések állapota <strong>Elküldve</strong>{' '}
            lesz, és rögzítjük az átadás időpontját.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirm} disabled={actionLoading}>
            Mégse
          </Button>
          <Button variant="contained" onClick={handleMarkShipped} disabled={actionLoading}>
            {actionLoading ? 'Folyamatban…' : 'Átadva'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen === 'pickup'} onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Átvéve</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pickupSelected.size} rendelés megjelölése átvettként? A rendelések állapota <strong>Átvéve</strong> (teljesítve)
            lesz — a vevő átvette a csomagot.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirm} disabled={actionLoading}>
            Mégse
          </Button>
          <Button variant="contained" onClick={handleMarkDelivered} disabled={actionLoading}>
            {actionLoading ? 'Folyamatban…' : 'Átvéve'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
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
  DialogActions
} from '@mui/material'
import { Search as SearchIcon, LocalShipping as ShippedIcon, CheckCircle as DeliveredIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface CarrierOrder {
  id: string
  order_number: string
  status: string
  tracking_number: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_city: string | null
  shipping_address1: string | null
  shipping_method_name: string | null
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

export default function DispatchTabs() {
  const [tabIndex, setTabIndex] = useState(0)
  const [carrierOrders, setCarrierOrders] = useState<CarrierOrder[]>([])
  const [pickupOrders, setPickupOrders] = useState<PickupOrder[]>([])
  const [carrierLoading, setCarrierLoading] = useState(true)
  const [pickupLoading, setPickupLoading] = useState(true)
  const [pickupSearch, setPickupSearch] = useState('')
  const [carrierSelected, setCarrierSelected] = useState<Set<string>>(new Set())
  const [pickupSelected, setPickupSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState<'carrier' | 'pickup' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCarrier = useCallback(async () => {
    setCarrierLoading(true)
    try {
      const res = await fetch('/api/dispatch/carrier')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCarrierOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a futárnak átadandók listáján')
    } finally {
      setCarrierLoading(false)
    }
  }, [])

  const fetchPickup = useCallback(async () => {
    setPickupLoading(true)
    try {
      const q = pickupSearch.trim() ? `?q=${encodeURIComponent(pickupSearch.trim())}` : ''
      const res = await fetch(`/api/dispatch/pickup${q}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPickupOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a személyes átvételek listáján')
    } finally {
      setPickupLoading(false)
    }
  }, [pickupSearch])

  useEffect(() => {
    fetchCarrier()
  }, [fetchCarrier])

  useEffect(() => {
    if (tabIndex === 1) fetchPickup()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load when switching to pickup tab; search runs on button click
  }, [tabIndex])

  const handleTabChange = (_: React.SyntheticEvent, v: number) => setTabIndex(v)

  const carrierAllChecked = carrierOrders.length > 0 && carrierSelected.size === carrierOrders.length
  const carrierSomeChecked = carrierSelected.size > 0
  const handleCarrierSelectAll = (checked: boolean) => {
    if (checked) setCarrierSelected(new Set(carrierOrders.map(o => o.id)))
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
    if (checked) setPickupSelected(new Set(pickupOrders.map(o => o.id)))
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

  return (
    <Box>
      <Tabs value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Futárnak átadandók" id="dispatch-tab-0" aria-controls="dispatch-panel-0" />
        <Tab label="Személyes átvételek" id="dispatch-tab-1" aria-controls="dispatch-panel-1" />
      </Tabs>

      {/* Carrier tab */}
      <Box role="tabpanel" hidden={tabIndex !== 0} id="dispatch-panel-0" aria-labelledby="dispatch-tab-0">
        {carrierLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : carrierOrders.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography color="text.secondary">
              Nincs futárnak átadandó rendelés. A Futárnak átadandó állapotú rendelések itt fognak megjelenni.
            </Typography>
          </Paper>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<ShippedIcon />}
                disabled={!carrierSomeChecked}
                onClick={handleConfirmCarrier}
              >
                Átadva ({carrierSelected.size})
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={carrierSomeChecked && !carrierAllChecked}
                        checked={carrierAllChecked}
                        onChange={(_, c) => handleCarrierSelectAll(c)}
                      />
                    </TableCell>
                    <TableCell>Rendelésszám</TableCell>
                    <TableCell>Átvevő / Cím</TableCell>
                    <TableCell>Szállítási mód</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {carrierOrders.map((order) => (
                    <TableRow key={order.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={carrierSelected.has(order.id)}
                          onChange={() => handleCarrierToggle(order.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{order.order_number}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') || order.shipping_company || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[order.shipping_city, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.shipping_method_name || '—'}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      {/* Pickup tab */}
      <Box role="tabpanel" hidden={tabIndex !== 1} id="dispatch-panel-1" aria-labelledby="dispatch-tab-1">
        {pickupLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Keresés (rendelésszám, név, cég, e‑mail)"
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
                sx={{ minWidth: 280 }}
              />
              <Button variant="outlined" size="small" onClick={() => fetchPickup()}>
                Keresés
              </Button>
              <Button
                variant="contained"
                startIcon={<DeliveredIcon />}
                disabled={!pickupSomeChecked}
                onClick={handleConfirmPickup}
              >
                Átvéve ({pickupSelected.size})
              </Button>
            </Box>
            {pickupOrders.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">
                  {pickupSearch.trim()
                    ? 'Nincs találat a keresésre.'
                    : 'Nincs személyes átvételre váró rendelés. A Személyes átvételre kész állapotú rendelések itt fognak megjelenni.'}
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="medium">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={pickupSomeChecked && !pickupAllChecked}
                          checked={pickupAllChecked}
                          onChange={(_, c) => handlePickupSelectAll(c)}
                        />
                      </TableCell>
                      <TableCell>Rendelésszám</TableCell>
                      <TableCell>Átvevő / Cím</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pickupOrders.map((order) => (
                      <TableRow key={order.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={pickupSelected.has(order.id)}
                            onChange={() => handlePickupToggle(order.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{order.order_number}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') || order.shipping_company || order.customer_email || '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[order.shipping_city, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Box>

      {/* Confirm Átadva */}
      <Dialog open={confirmOpen === 'carrier'} onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Átadva a futárnak</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {carrierSelected.size} rendelés megjelölése átadottként? A rendelések állapota „Átadva” lesz, és rögzítjük az átadás időpontját.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirm} disabled={actionLoading}>Mégse</Button>
          <Button variant="contained" onClick={handleMarkShipped} disabled={actionLoading}>
            {actionLoading ? 'Folyamatban…' : 'Átadva'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Átvéve */}
      <Dialog open={confirmOpen === 'pickup'} onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Átvéve</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pickupSelected.size} rendelés megjelölése átvettként? A vevő átvette a csomagot.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirm} disabled={actionLoading}>Mégse</Button>
          <Button variant="contained" onClick={handleMarkDelivered} disabled={actionLoading}>
            {actionLoading ? 'Folyamatban…' : 'Átvéve'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

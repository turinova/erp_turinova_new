'use client'

import React, { useEffect, useState } from 'react'
import {
  Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, IconButton
} from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'

interface ShipmentDetailClientProps {
  id: string
  initialHeader?: ShipmentHeader | null
  initialItems?: ShipmentItem[]
  initialVatRates?: Map<string, number>
}

interface ShipmentItem {
  id: string
  purchase_order_item_id: string
  product_name: string
  sku: string
  quantity_received: number
  target_quantity: number
  net_price: number
  net_total: number
  gross_total: number
  vat_id: string
  currency_id: string
  units_id: string
  note?: string
}

interface ShipmentHeader {
  id: string
  purchase_order_id: string
  po_number: string
  po_created_at: string
  partner_id: string
  partner_name: string
  warehouse_id: string
  warehouse_name: string
  shipment_date: string
  status: string
  note?: string
  created_at: string
  stock_movement_numbers?: string[]
}

export default function ShipmentDetailClient({ 
  id, 
  initialHeader = null, 
  initialItems = [], 
  initialVatRates = new Map() 
}: ShipmentDetailClientProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false)
  const [header, setHeader] = useState<ShipmentHeader | null>(initialHeader)
  const [items, setItems] = useState<ShipmentItem[]>(initialItems)
  const [vatRates, setVatRates] = useState<Map<string, number>>(initialVatRates)

  // Only fetch if we don't have initial data
  useEffect(() => {
    if (!initialHeader || initialItems.length === 0) {
      fetchData()
    }
    if (initialVatRates.size === 0) {
      fetchVatRates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchVatRates = async () => {
    try {
      const res = await fetch('/api/vat')
      const data = await res.json()
      if (res.ok && data.vat) {
        const vatMap = new Map<string, number>()
        data.vat.forEach((v: any) => {
          vatMap.set(v.id, v.kulcs || 0)
        })
        setVatRates(vatMap)
      }
    } catch (e) {
      console.error('Error fetching VAT rates:', e)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shipments/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a szállítmány betöltésekor')
      setHeader(data.header)
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a szállítmány betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!header) return
    setSaving(true)
    try {
      const updates = items.map(it => ({
        id: it.id,
        quantity_received: it.quantity_received,
        net_price: it.net_price,
        note: it.note || null
      }))
      const res = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a mentéskor')
      toast.success('Mentve')
      fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a mentés során')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a tételt?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id: itemId, deleted: true }]
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a tétel törlésekor')
      toast.success('Tétel törölve')
      fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a tétel törlésekor')
    } finally {
      setSaving(false)
    }
  }

  const handleReceiveShipment = () => {
    if (!header) return
    
    // Validate that at least one item has quantity_received > 0
    const hasReceivedQty = items.some(it => it.quantity_received > 0)
    if (!hasReceivedQty) {
      toast.error('Legalább egy tételnél meg kell adni a szállított mennyiséget')
      return
    }

    setReceiveConfirmOpen(true)
  }

  const handleConfirmReceiveShipment = async () => {
    if (!header) return
    setReceiveConfirmOpen(false)
    setReceiving(true)
    try {
      // First, save all item changes (quantities and prices)
      const updates = items.map(it => ({
        id: it.id,
        quantity_received: it.quantity_received,
        net_price: it.net_price,
        note: it.note || null
      }))
      const saveRes = await fetch(`/api/shipments/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      if (!saveRes.ok) {
        const saveData = await saveRes.json()
        throw new Error(saveData?.error || 'Hiba a mentéskor')
      }

      // Then, receive the shipment
      const res = await fetch(`/api/shipments/${id}/receive`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a bevételezéskor')
      
      const poStatusText = data.po_status === 'received' ? 'Teljesen beérkezett' : 'Részben beérkezett'
      toast.success(`Szállítmány sikeresen bevételezve. PO státusz: ${poStatusText}`)
      // Reload data to show updated status
      await fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a szállítmány bevételezésekor')
    } finally {
      setReceiving(false)
    }
  }

  const updateItemQuantity = (index: number, value: number | '') => {
    setItems(prev => {
      const copy = [...prev]
      const item = copy[index]
      const qty = value === '' ? 0 : value
      const netTotal = qty * item.net_price
      const vatPercent = vatRates.get(item.vat_id) || 0
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
      const grossTotal = netTotal + vatAmount
      copy[index] = {
        ...item,
        quantity_received: qty,
        net_total: netTotal,
        gross_total: grossTotal
      }
      return copy
    })
  }

  const updateItemNetPrice = (index: number, value: number | '') => {
    setItems(prev => {
      const copy = [...prev]
      const item = copy[index]
      const price = value === '' ? 0 : value
      const netTotal = item.quantity_received * price
      const vatPercent = vatRates.get(item.vat_id) || 0
      const vatAmount = Math.round(netTotal * (vatPercent / 100))
      const grossTotal = netTotal + vatAmount
      copy[index] = {
        ...item,
        net_price: price,
        net_total: netTotal,
        gross_total: grossTotal
      }
      return copy
    })
  }

  const totals = items.reduce((acc, it) => {
    acc.net += it.net_total
    acc.gross += it.gross_total
    return acc
  }, { net: 0, gross: 0 })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!header) {
    return <Box sx={{ p: 3 }}>Szállítmány nem található</Box>
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={NextLink} underline="hover" color="inherit" href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link component={NextLink} underline="hover" color="inherit" href="/shipments">
          Szállítmányok
        </Link>
        <Typography color="text.primary">Szállítmány</Typography>
      </Breadcrumbs>

      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Alap adatok</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Beszállító"
                value={header.partner_name}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Raktár"
                value={header.warehouse_name}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="PO létrehozva"
                value={header.po_created_at ? new Date(header.po_created_at).toLocaleDateString('hu-HU') : ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Kiszállítva dátuma"
                value={header.created_at ? new Date(header.created_at).toLocaleDateString('hu-HU') : ''}
                disabled
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">PO szám:</Typography>
                <Link component={NextLink} href={`/purchase-order/${header.purchase_order_id}`} underline="hover" sx={{ fontWeight: 500 }}>
                  {header.po_number}
                </Link>
              </Box>
            </Grid>
            {header.stock_movement_numbers && header.stock_movement_numbers.length > 0 && (
              <Grid item xs={12} md={9}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">Készletmozgás számok:</Typography>
                  {header.stock_movement_numbers.map((smNumber, idx) => (
                    <Chip
                      key={idx}
                      label={smNumber}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Tételek</Typography>
          <Stack spacing={2}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Termék neve</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="right">Szállított mennyiség</TableCell>
                    <TableCell align="right">Cél mennyiség</TableCell>
                    <TableCell align="right">Nettó egységár</TableCell>
                    <TableCell align="right">Nettó összesen</TableCell>
                    <TableCell align="right">Bruttó összesen</TableCell>
                    <TableCell>Művelet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        Nincs tétel
                      </TableCell>
                    </TableRow>
                  ) : items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={item.quantity_received === 0 ? '' : item.quantity_received}
                          onChange={(e) => {
                            const val = e.target.value
                            updateItemQuantity(idx, val === '' ? '' : Number(val) || 0)
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              updateItemQuantity(idx, 0)
                            }
                          }}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ 
                            width: 100,
                            ...(item.quantity_received > item.target_quantity && {
                              '& .MuiOutlinedInput-root': {
                                borderColor: 'error.main',
                                '&:hover': {
                                  borderColor: 'error.main',
                                },
                                '&.Mui-focused': {
                                  borderColor: 'error.main',
                                }
                              }
                            })
                          }}
                          placeholder="0"
                          disabled={header.status === 'received' || header.status === 'cancelled'}
                          error={item.quantity_received > item.target_quantity}
                          helperText={item.quantity_received > item.target_quantity ? 'Több mint a cél mennyiség' : ''}
                        />
                      </TableCell>
                      <TableCell align="right">{item.target_quantity}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={item.net_price === 0 ? '' : item.net_price}
                          onChange={(e) => {
                            const val = e.target.value
                            updateItemNetPrice(idx, val === '' ? '' : Number(val) || 0)
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '') {
                              updateItemNetPrice(idx, 0)
                            }
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          sx={{ width: 120 }}
                          placeholder="0"
                          disabled={header.status === 'received' || header.status === 'cancelled'}
                        />
                      </TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.net_total)} Ft</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat('hu-HU').format(item.gross_total)} Ft</TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={header.status === 'received' || header.status === 'cancelled'}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="right"><strong>Összesen:</strong></TableCell>
                      <TableCell align="right"><strong>{new Intl.NumberFormat('hu-HU').format(totals.net)} Ft</strong></TableCell>
                      <TableCell align="right"><strong>{new Intl.NumberFormat('hu-HU').format(totals.gross)} Ft</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          {header.status === 'draft' && (
            <>
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving || receiving}
              >
                Mentés
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={receiving ? <CircularProgress size={18} /> : <SaveIcon />}
                onClick={handleReceiveShipment}
                disabled={saving || receiving}
              >
                Szállítmány bevételezése
              </Button>
            </>
          )}
          {header.status === 'received' && (
            <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Szállítmány bevételezve
            </Typography>
          )}
          {header.status === 'cancelled' && (
            <Typography variant="body2" color="error.main">
              Szállítmány törölve
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Receive Shipment Confirmation Dialog */}
      <Dialog
        open={receiveConfirmOpen}
        onClose={() => setReceiveConfirmOpen(false)}
        aria-labelledby="receive-dialog-title"
        aria-describedby="receive-dialog-description"
      >
        <DialogTitle id="receive-dialog-title">
          Szállítmány bevételezése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="receive-dialog-description">
            Biztosan be szeretnéd vételezni ezt a szállítmányt? Ez létrehozza a készletmozgásokat és frissíti a beszerzési rendelés státuszát.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReceiveConfirmOpen(false)}
            disabled={receiving}
          >
            Mégse
          </Button>
          <Button
            onClick={handleConfirmReceiveShipment}
            variant="contained"
            color="primary"
            disabled={receiving}
            startIcon={receiving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {receiving ? 'Bevételezés...' : 'Bevételezés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}


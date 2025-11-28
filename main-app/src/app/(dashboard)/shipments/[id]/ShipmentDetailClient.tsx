'use client'

import React, { useEffect, useState, useRef } from 'react'
import {
  Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, IconButton, Checkbox, FormControlLabel, FormGroup
} from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon, Delete as DeleteIcon, AddCircle as AddCircleIcon, RemoveCircle as RemoveCircleIcon, Check as CheckIcon } from '@mui/icons-material'
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
  receipt_workers?: Array<{
    id: string
    name: string
    nickname: string | null
    color: string
    received_at: string
  }>
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
  const [workers, setWorkers] = useState<Array<{ id: string; name: string; nickname: string | null; color: string }>>([])
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
  
  // Barcode scanning state
  const [barcodeInput, setBarcodeInput] = useState('')
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef(false)

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

  // Fetch workers on component mount so they're ready when modal opens
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/workers')
        if (response.ok) {
          const workersData = await response.json()
          setWorkers(workersData || [])
        }
      } catch (error) {
        console.error('Error fetching workers:', error)
        // Don't show error toast here - it's not critical for page load
      }
    }
    fetchWorkers()
  }, []) // Only run once on mount

  // Focus barcode input on mount and when status is draft
  useEffect(() => {
    if (header?.status === 'draft' && barcodeInputRef.current) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [header?.status])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

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

  const handleReceiveShipment = async () => {
    if (!header) return
    
    // Validate that at least one item has quantity_received > 0
    const hasReceivedQty = items.some(it => it.quantity_received > 0)
    if (!hasReceivedQty) {
      toast.error('Legalább egy tételnél meg kell adni a szállított mennyiséget')
      return
    }

    // Workers are already fetched on component mount, just open the modal
    setSelectedWorkerIds([])
    setReceiveConfirmOpen(true)
  }

  const handleConfirmReceiveShipment = async () => {
    if (!header) return
    
    // Validate that at least one worker is selected
    if (selectedWorkerIds.length === 0) {
      toast.error('Legalább egy dolgozót ki kell választani')
      return
    }

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

      // Then, receive the shipment with worker IDs
      const res = await fetch(`/api/shipments/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_ids: selectedWorkerIds })
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

  // Handle barcode input change (debounced for scanner)
  const handleBarcodeInputChange = (value: string) => {
    setBarcodeInput(value)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Set new timeout - trigger scan when input stops changing for 100ms
    scanTimeoutRef.current = setTimeout(() => {
      const trimmedValue = value.trim()
      if (trimmedValue.length > 0 && !isScanningRef.current && header?.status === 'draft') {
        handleBarcodeScan(trimmedValue)
      }
    }, 100)
  }

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode || !barcode.trim() || header?.status !== 'draft') {
      refocusBarcodeInput()
      return
    }

    const trimmedBarcode = barcode.trim()

    // Prevent multiple scans while one is in progress
    if (isScanningRef.current) {
      refocusBarcodeInput()
      return
    }

    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    // Mark as scanning
    isScanningRef.current = true

    try {
      // Fetch accessory by barcode
      const response = await fetch(`/api/pos/accessories/by-barcode?barcode=${encodeURIComponent(trimmedBarcode)}`)
      
      if (!response.ok) {
        const data = await response.json()
        if (response.status === 404) {
          toast.error('Vonalkód nem található a rendszerben')
        } else {
          toast.error('Hiba a vonalkód keresésekor')
        }
        setBarcodeInput('')
        refocusBarcodeInput()
        return
      }

      const accessoryData = await response.json()
      const sku = accessoryData.sku

      // Find matching items by SKU
      const matchingItems = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.sku === sku)

      if (matchingItems.length === 0) {
        toast.error(`A termék (SKU: ${sku}) nem található ebben a szállítmányban`)
        setBarcodeInput('')
        refocusBarcodeInput()
        return
      }

      // Find first matching item (allow exceeding target_quantity)
      const itemToUpdate = matchingItems[0]

      if (!itemToUpdate) {
        // This shouldn't happen since we already checked matchingItems.length === 0
        toast.error(`A termék (SKU: ${sku}) nem található ebben a szállítmányban`)
        setBarcodeInput('')
        refocusBarcodeInput()
        return
      }

      // Update quantity_received by 1
      const newQuantity = itemToUpdate.item.quantity_received + 1
      updateItemQuantity(itemToUpdate.index, newQuantity)

      // Highlight the quantity field
      setHighlightedItemId(itemToUpdate.item.id)
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedItemId(null)
      }, 1000)

      setBarcodeInput('')
    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Hiba a vonalkód feldolgozásakor')
      setBarcodeInput('')
    } finally {
      isScanningRef.current = false
      refocusBarcodeInput()
    }
  }

  // Refocus barcode input
  const refocusBarcodeInput = () => {
    if (header?.status === 'draft' && barcodeInputRef.current) {
      setTimeout(() => {
        barcodeInputRef.current?.focus()
        barcodeInputRef.current?.select()
      }, 10)
    }
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
      {/* Hidden barcode input for scanner */}
      {header?.status === 'draft' && (
        <TextField
          inputRef={barcodeInputRef}
          value={barcodeInput}
          onChange={(e) => handleBarcodeInputChange(e.target.value)}
          onKeyDown={(e) => {
            // Barcode scanners often send Enter at the end
            if (e.key === 'Enter') {
              e.preventDefault()
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current)
                scanTimeoutRef.current = null
              }
              const trimmedValue = barcodeInput.trim()
              if (trimmedValue.length > 0 && !isScanningRef.current) {
                handleBarcodeScan(trimmedValue)
              }
            }
          }}
          sx={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'auto',
            zIndex: -1
          }}
          autoFocus
          tabIndex={0}
          onBlur={(e) => {
            // Only refocus if we're not clicking on an input field
            const target = e.relatedTarget as HTMLElement
            if (!target || !target.closest('input, textarea, select')) {
              refocusBarcodeInput()
            }
          }}
        />
      )}

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
            {header.receipt_workers && header.receipt_workers.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">Bevételezte:</Typography>
                  {header.receipt_workers.map((worker) => (
                    <Chip
                      key={worker.id}
                      label={worker.nickname || worker.name}
                      size="small"
                      sx={{
                        backgroundColor: worker.color || '#1976d2',
                        color: 'white',
                        fontWeight: 500
                      }}
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
                  ) : items.map((item, idx) => {
                    // Determine row background color based on quantity comparison
                    const getRowBackgroundColor = () => {
                      if (item.quantity_received < item.target_quantity) {
                        return 'rgba(244, 67, 54, 0.05)' // Very light red
                      } else if (item.quantity_received === item.target_quantity) {
                        return 'rgba(76, 175, 80, 0.05)' // Very light green
                      } else {
                        return 'rgba(255, 152, 0, 0.05)' // Very light orange
                      }
                    }

                    return (
                      <TableRow 
                        key={item.id}
                        sx={{
                          backgroundColor: getRowBackgroundColor(),
                          '&:hover': {
                            backgroundColor: (theme) => {
                              const baseColor = getRowBackgroundColor()
                              // Slightly darken on hover while maintaining the base color
                              if (item.quantity_received < item.target_quantity) {
                                return 'rgba(244, 67, 54, 0.1)'
                              } else if (item.quantity_received === item.target_quantity) {
                                return 'rgba(76, 175, 80, 0.1)'
                              } else {
                                return 'rgba(255, 152, 0, 0.1)'
                              }
                            }
                          }
                        }}
                      >
                        <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          {header.status === 'draft' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                const newQuantity = Math.max(0, item.quantity_received - 1)
                                updateItemQuantity(idx, newQuantity)
                              }}
                              disabled={item.quantity_received <= 0}
                              sx={{ 
                                width: 32, 
                                height: 32,
                                '&:disabled': {
                                  opacity: 0.3
                                }
                              }}
                            >
                              <RemoveCircleIcon fontSize="small" />
                            </IconButton>
                          )}
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
                              // Refocus barcode input after editing
                              if (header?.status === 'draft') {
                                refocusBarcodeInput()
                              }
                            }}
                            onFocus={() => {
                              // Clear highlight when user manually edits
                              if (highlightedItemId === item.id) {
                                setHighlightedItemId(null)
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
                              }),
                              ...(highlightedItemId === item.id && {
                                '& .MuiOutlinedInput-root': {
                                  borderColor: 'success.main',
                                  borderWidth: 2,
                                  borderStyle: 'solid',
                                  animation: 'glow 1s ease-out',
                                  '@keyframes glow': {
                                    '0%': {
                                      boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)',
                                    },
                                    '50%': {
                                      boxShadow: '0 0 10px 5px rgba(76, 175, 80, 0.5)',
                                    },
                                    '100%': {
                                      boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)',
                                    }
                                  }
                                }
                              })
                            }}
                            placeholder="0"
                            disabled={header.status === 'received' || header.status === 'cancelled'}
                            error={item.quantity_received > item.target_quantity}
                            helperText={item.quantity_received > item.target_quantity ? 'Több mint a cél mennyiség' : ''}
                          />
                          {header.status === 'draft' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                const newQuantity = item.quantity_received + 1
                                updateItemQuantity(idx, newQuantity)
                              }}
                              sx={{ 
                                width: 32, 
                                height: 32
                              }}
                            >
                              <AddCircleIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
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
                    )
                  })}
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
        onClose={(event, reason) => {
          // Only close on backdrop click or escape, not on content clicks
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            setReceiveConfirmOpen(false)
          }
        }}
        aria-labelledby="receive-dialog-title"
        aria-describedby="receive-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="receive-dialog-title">
          Szállítmány bevételezése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="receive-dialog-description" sx={{ mb: 3 }}>
            Biztosan be szeretnéd vételezni ezt a szállítmányt? Ez létrehozza a készletmozgásokat és frissíti a beszerzési rendelés státuszát.
          </DialogContentText>
          
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Válassz dolgozó(kat) aki(k) bevételezik:
          </Typography>
          
          <Grid container spacing={1.5}>
            {workers.map((worker) => {
              const isSelected = selectedWorkerIds.includes(worker.id)
              const workerColor = worker.color || '#1976d2'
              return (
                <Grid item xs={3} key={worker.id}>
                  <Button
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={(e) => {
                      e.stopPropagation() // Prevent event bubbling to Dialog
                      e.preventDefault() // Prevent default behavior
                      setSelectedWorkerIds(prev => {
                        if (isSelected) {
                          return prev.filter(id => id !== worker.id)
                        } else {
                          return [...prev, worker.id]
                        }
                      })
                    }}
                    startIcon={isSelected ? <CheckIcon /> : <Box sx={{ width: 24, height: 24 }} />}
                    fullWidth
                    sx={{
                      backgroundColor: isSelected ? workerColor : 'transparent',
                      color: isSelected ? 'white' : 'text.primary',
                      borderColor: workerColor,
                      borderWidth: 2,
                      borderStyle: 'solid',
                      minHeight: 56, // Large touch target for iOS
                      fontSize: '1rem',
                      fontWeight: 500,
                      textTransform: 'none',
                      justifyContent: 'flex-start',
                      touchAction: 'manipulation', // Prevent double-tap zoom
                      WebkitTapHighlightColor: 'transparent', // Remove iOS tap highlight
                      userSelect: 'none',
                      '&:hover': {
                        backgroundColor: isSelected ? workerColor : 'action.hover',
                        opacity: isSelected ? 0.9 : 1,
                        borderColor: workerColor
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                        opacity: 0.95
                      },
                      '& .MuiButton-startIcon': {
                        marginRight: 1
                      }
                    }}
                  >
                    {worker.nickname || worker.name}
                  </Button>
                </Grid>
              )
            })}
          </Grid>
          
          {workers.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Nincsenek elérhető dolgozók
            </Typography>
          )}
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
            disabled={receiving || selectedWorkerIds.length === 0}
            startIcon={receiving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {receiving ? 'Bevételezés...' : 'Bevételezés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}


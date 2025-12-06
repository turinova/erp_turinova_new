'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  CheckCircle as ReadyIcon,
  Warning as PendingIcon,
  Add as CreateIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { RadioGroup, FormControlLabel, Radio } from '@mui/material'

interface CustomerOrderItem {
  id: string
  product_name: string
  sku: string
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  partner_id: string | null
  partner_name: string | null
  accessory_id?: string | null
  material_id?: string | null
  linear_material_id?: string | null
  units_id: string
  vat_id: string
  currency_id: string
  accessories?: { name: string; sku: string } | null
  materials?: { name: string } | null
  linear_materials?: { name: string } | null
  product_type?: string | null
}

interface CreatePurchaseOrderModalProps {
  open: boolean
  onClose: () => void
  selectedItems: CustomerOrderItem[]
  warehouses: Array<{ id: string; name: string }>
  onSuccess: () => void
}

export default function CreatePurchaseOrderModal({
  open,
  onClose,
  selectedItems,
  warehouses,
  onSuccess
}: CreatePurchaseOrderModalProps) {
  const [warehouseId, setWarehouseId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  // Draft PO selection
  const [draftPOs, setDraftPOs] = useState<any[]>([])
  const [isLoadingDraftPOs, setIsLoadingDraftPOs] = useState(false)
  const [poOption, setPoOption] = useState<'existing' | 'new'>('new')
  const [selectedExistingPoId, setSelectedExistingPoId] = useState('')
  
  // Track actions for each item
  const [itemActions, setItemActions] = useState<Map<string, any>>(new Map())
  
  // Track inline data for creating new accessories
  const [newItemData, setNewItemData] = useState<Map<string, any>>(new Map())

  // Helper function to get display name from database or fallback
  const getDisplayName = (item: CustomerOrderItem): string => {
    if (item.accessory_id && item.accessories) {
      return item.accessories.name
    } else if (item.material_id && item.materials) {
      return item.materials.name
    } else if (item.linear_material_id && item.linear_materials) {
      return item.linear_materials.name
    }
    return item.product_name
  }

  // Helper function to get display SKU
  const getDisplaySku = (item: CustomerOrderItem): string => {
    if (item.accessory_id && item.accessories?.sku) {
      return item.accessories.sku
    }
    return item.sku || '-'
  }

  // Categorize items
  const readyItems = selectedItems.filter(item => 
    item.accessory_id || item.material_id || item.linear_material_id
  )
  const pendingItems = selectedItems.filter(item => 
    !item.accessory_id && !item.material_id && !item.linear_material_id
  )

  // Fetch draft POs for this partner when modal opens
  useEffect(() => {
    if (open && selectedItems.length > 0) {
      const partnerId = selectedItems[0]?.partner_id
      if (partnerId) {
        fetchDraftPOs(partnerId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Set default warehouse when modal opens
  useEffect(() => {
    if (open && warehouses.length > 0 && !warehouseId && poOption === 'new') {
      setWarehouseId(warehouses[0].id)
    }
  }, [open, warehouses, warehouseId, poOption])

  // Update fields when user selects existing PO
  useEffect(() => {
    if (poOption === 'existing' && selectedExistingPoId) {
      const selectedPO = draftPOs.find(po => po.id === selectedExistingPoId)
      if (selectedPO) {
        setWarehouseId(selectedPO.warehouse_id)
        setExpectedDate(selectedPO.expected_date || '')
      }
    } else if (poOption === 'new' && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id)
      setExpectedDate('')
    }
  }, [poOption, selectedExistingPoId, draftPOs, warehouses, warehouseId])

  // Initialize new item data with defaults when modal opens
  useEffect(() => {
    if (open && pendingItems.length > 0 && newItemData.size === 0) {
      const initialData = new Map()
      pendingItems.forEach(item => {
        // Calculate base_price from unit_price_net (which is base_price * multiplier)
        // We need to reverse engineer: base_price = unit_price_net / multiplier
        // But we don't have multiplier stored, so estimate or use unit_price_net as base_price
        const estimatedBasePrice = Math.round(item.unit_price_net / 1.38) // Assume default multiplier
        initialData.set(item.id, {
          name: item.product_name,
          sku: item.sku || '',
          base_price: estimatedBasePrice,
          multiplier: 1.38
        })
      })
      setNewItemData(initialData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchDraftPOs = async (partnerId: string) => {
    setIsLoadingDraftPOs(true)
    try {
      const res = await fetch(`/api/purchase-order?status=draft`)
      if (res.ok) {
        const data = await res.json()
        const partnerDraftPOs = (data.purchase_orders || []).filter((po: any) => {
          return po.partner_id === partnerId
        })
        setDraftPOs(partnerDraftPOs)
        
        if (partnerDraftPOs.length > 0) {
          setPoOption('existing')
          setSelectedExistingPoId(partnerDraftPOs[0].id)
        } else {
          setPoOption('new')
        }
      }
    } catch (error) {
      console.error('Error fetching draft POs:', error)
    } finally {
      setIsLoadingDraftPOs(false)
    }
  }

  const handleCreatePO = async () => {
    if (!warehouseId) {
      toast.error('Válassz raktárat!')
      return
    }

    // Check all pending items have actions
    const unresolved = pendingItems.filter(item => !itemActions.has(item.id))
    if (unresolved.length > 0) {
      toast.error(`${unresolved.length} tétel még nincs kezelve`)
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/customer-order-items/create-purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_order_item_ids: selectedItems.map(i => i.id),
          warehouse_id: warehouseId,
          expected_date: expectedDate || null,
          existing_po_id: poOption === 'existing' ? selectedExistingPoId : null,
          item_actions: Array.from(itemActions.entries()).map(([item_id, action]) => ({
            item_id,
            ...action
          }))
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hiba')

      const message = data.is_new_po 
        ? `PO létrehozva: ${data.po_number} (${data.items_added} tétel${data.new_accessories_created > 0 ? `, ${data.new_accessories_created} új termék` : ''})`
        : `Hozzáadva a PO-hoz: ${data.po_number} (${data.items_added} tétel${data.new_accessories_created > 0 ? `, ${data.new_accessories_created} új termék` : ''})`
      
      toast.success(message)
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Hiba a PO létrehozásakor')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateNew = (itemId: string, item: CustomerOrderItem) => {
    const data = newItemData.get(itemId)
    if (!data?.sku || data.sku.trim() === '') {
      toast.error('SKU megadása kötelező!')
      return
    }
    
    setItemActions(prev => new Map(prev).set(itemId, {
      action: 'create',
      new_accessory_data: {
        name: data.name.trim(),
        sku: data.sku.trim(),
        base_price: data.base_price,
        multiplier: data.multiplier
      }
    }))
  }

  const handleSkip = (itemId: string) => {
    setItemActions(prev => new Map(prev).set(itemId, {
      action: 'skip'
    }))
  }

  const handleClose = () => {
    setWarehouseId('')
    setExpectedDate('')
    setItemActions(new Map())
    setNewItemData(new Map())
    setDraftPOs([])
    setPoOption('new')
    setSelectedExistingPoId('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Beszerzési rendelés létrehozása</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedItems.length} tétel kiválasztva. 
            Beszállító: <strong>{selectedItems[0]?.partner_name || 'Nincs beszállító'}</strong>
          </Alert>

          {/* PO Selection */}
          {isLoadingDraftPOs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : draftPOs.length > 0 ? (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Beszerzési rendelés kiválasztása:
              </Typography>
              <RadioGroup
                value={poOption}
                onChange={(e) => setPoOption(e.target.value as 'existing' | 'new')}
              >
                <FormControlLabel
                  value="existing"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>Hozzáadás meglévő PO-hoz:</Typography>
                      <FormControl size="small" sx={{ minWidth: 300 }} disabled={poOption !== 'existing'}>
                        <Select
                          value={selectedExistingPoId}
                          onChange={(e) => setSelectedExistingPoId(e.target.value)}
                          displayEmpty
                        >
                          {draftPOs.map(po => (
                            <MenuItem key={po.id} value={po.id}>
                              {po.po_number} - Létrehozva: {new Date(po.created_at).toLocaleDateString('hu-HU', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="new"
                  control={<Radio />}
                  label="Új PO létrehozása"
                />
              </RadioGroup>
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <FormControl fullWidth required>
              <InputLabel>Raktár</InputLabel>
              <Select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                label="Raktár"
              >
                {warehouses.map(wh => (
                  <MenuItem key={wh.id} value={wh.id}>{wh.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Várható érkezés"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </Box>

        {/* Ready Items */}
        {readyItems.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReadyIcon color="success" />
              Kész tételek ({readyItems.length})
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Termék</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="right">Mennyiség</TableCell>
                  <TableCell>Állapot</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {readyItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{getDisplayName(item)}</TableCell>
                    <TableCell>{getDisplaySku(item)}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell>
                      <Chip label="Kész" color="success" size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PendingIcon color="warning" />
              Kezelendő tételek ({pendingItems.length})
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Ezek a tételek még nincsenek a termékadatbázisban. Add meg a SKU-t vagy hagyd ki!
            </Alert>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Termék név</TableCell>
                  <TableCell>SKU *</TableCell>
                  <TableCell align="right">Mennyiség</TableCell>
                  <TableCell>Művelet</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingItems.map(item => {
                  const action = itemActions.get(item.id)
                  const itemData = newItemData.get(item.id) || {}
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={itemData.name || ''}
                          onChange={(e) => setNewItemData(prev => new Map(prev).set(item.id, {
                            ...itemData,
                            name: e.target.value
                          }))}
                          disabled={!!action}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Kötelező"
                          required
                          value={itemData.sku || ''}
                          onChange={(e) => setNewItemData(prev => new Map(prev).set(item.id, {
                            ...itemData,
                            sku: e.target.value
                          }))}
                          error={!action && (!itemData.sku || itemData.sku.trim() === '')}
                          disabled={!!action}
                        />
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell>
                        {!action ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<CreateIcon />}
                              onClick={() => handleCreateNew(item.id, item)}
                              disabled={!itemData.sku || itemData.sku.trim() === ''}
                            >
                              Új termék
                            </Button>
                            
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleSkip(item.id)}
                            >
                              Kihagyás
                            </Button>
                          </Box>
                        ) : (
                          <Chip
                            label={
                              action.action === 'create' ? `✓ Új: ${action.new_accessory_data.name} (${action.new_accessory_data.sku})` :
                              'Kihagyva'
                            }
                            color={action.action === 'skip' ? 'default' : 'success'}
                            onDelete={() => {
                              setItemActions(prev => {
                                const newMap = new Map(prev)
                                newMap.delete(item.id)
                                return newMap
                              })
                              setNewItemData(prev => {
                                const newMap = new Map(prev)
                                newMap.delete(item.id)
                                return newMap
                              })
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isCreating}>
          Mégse
        </Button>
        <Button
          variant="contained"
          onClick={handleCreatePO}
          disabled={isCreating || !warehouseId || pendingItems.some(item => !itemActions.has(item.id))}
          startIcon={isCreating ? <CircularProgress size={18} /> : null}
        >
          {isCreating ? 'Létrehozás...' : 'PO Létrehozása'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}


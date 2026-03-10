'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Button,
  Autocomplete,
  CircularProgress,
  Chip,
  InputAdornment
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface ShipmentItem {
  id: string
  shipment_id: string
  purchase_order_item_id: string | null
  product_id: string
  products: { id: string; name: string; sku: string; model_number: string | null } | null
  product_suppliers: { id: string; supplier_sku: string | null } | null
  expected_quantity: number
  received_quantity: number
  unit_cost: number | null
  vat_id: string | null
  vat: { id: string; name: string; kulcs: number } | null
  currency_id: string | null
  is_unexpected: boolean
  purchase_order_items: { id: string; quantity: number } | null
}

interface ShipmentItemsTableProps {
  items: ShipmentItem[]
  onItemsChange: (items: ShipmentItem[]) => void
  vatRates: Array<{ id: string; name: string; rate: number }>
  units: Array<{ id: string; name: string; shortform: string }>
  canEdit: boolean
  onProductSearch: (searchTerm: string) => Promise<any[]>
}

export default function ShipmentItemsTable({
  items,
  onItemsChange,
  vatRates,
  units,
  canEdit,
  onProductSearch
}: ShipmentItemsTableProps) {
  const [addingProduct, setAddingProduct] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Debounced product search
  useEffect(() => {
    if (productSearchTerm.trim().length < 2) {
      setProductSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearchingProducts(true)
      try {
        const results = await onProductSearch(productSearchTerm)
        setProductSearchResults(results)
      } catch (error) {
        console.error('Error searching products:', error)
        setProductSearchResults([])
      } finally {
        setSearchingProducts(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [productSearchTerm, onProductSearch])

  const updateItemQuantity = (index: number, value: number) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      received_quantity: Math.max(0, value)
    }
    onItemsChange(newItems)
  }

  const updateItemNetPrice = (index: number, value: number) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      unit_cost: value
    }
    onItemsChange(newItems)
  }

  const handleDeleteItem = async (index: number) => {
    const item = items[index]
    
    // Can only delete unexpected items
    if (!item.is_unexpected) {
      toast.error('A beszerzési rendelésből származó tételek nem törölhetők')
      return
    }

    if (!confirm('Biztosan törölni szeretné ezt a tételt?')) {
      return
    }

    // If item has an ID, delete from server
    if (item.id && !item.id.startsWith('temp-')) {
      try {
        const response = await fetch(`/api/shipments/${item.shipment_id}/items/${item.id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Hiba a tétel törlésekor')
        }
      } catch (error) {
        console.error('Error deleting item:', error)
        toast.error('Hiba a tétel törlésekor')
        return
      }
    }

    // Remove from local state
    const newItems = items.filter((_, i) => i !== index)
    onItemsChange(newItems)
    toast.success('Tétel törölve')
  }

  const handleAddProduct = async (product: any) => {
    if (!product) return

    // Check if product already exists
    const existingItem = items.find(item => item.product_id === product.product_id)
    if (existingItem) {
      toast.error('Ez a termék már szerepel a listában')
      setAddingProduct(false)
      setProductSearchTerm('')
      return
    }

    // Get default VAT and currency from first item or shipment
    const defaultVatId = vatRates[0]?.id || ''
    const defaultCurrencyId = items[0]?.currency_id || null

    const newItem: ShipmentItem = {
      id: `temp-${Date.now()}`,
      shipment_id: items[0]?.shipment_id || '',
      purchase_order_item_id: null,
      product_id: product.product_id,
      products: {
        id: product.product_id,
        name: product.product_name,
        sku: product.product_sku,
        model_number: product.model_number || null
      },
      product_suppliers: null,
      expected_quantity: 0, // No goal for unexpected items
      received_quantity: 1,
      unit_cost: product.cost || 0,
      vat_id: product.vat_id || defaultVatId,
      vat: vatRates.find(v => v.id === (product.vat_id || defaultVatId)) || null,
      currency_id: defaultCurrencyId,
      is_unexpected: true,
      purchase_order_items: null
    }

    onItemsChange([...items, newItem])
    setAddingProduct(false)
    setProductSearchTerm('')
    setProductSearchResults([])
    toast.success('Termék hozzáadva')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Calculate totals
  const totals = items.reduce((acc, item) => {
    const netPrice = item.unit_cost || 0
    const vatRate = item.vat?.kulcs || 0
    const netTotal = item.received_quantity * netPrice
    const vatAmount = netTotal * (vatRate / 100)
    const grossTotal = netTotal + vatAmount

    acc.netTotal += netTotal
    acc.vatTotal += vatAmount
    acc.grossTotal += grossTotal
    acc.itemCount += 1
    acc.totalReceived += item.received_quantity

    return acc
  }, {
    netTotal: 0,
    vatTotal: 0,
    grossTotal: 0,
    itemCount: 0,
    totalReceived: 0
  })

  // Get row background color based on quantity comparison
  // Always show color coding, even after completion
  const getRowBackgroundColor = (item: ShipmentItem) => {
    // Unexpected items have no goal, so no color
    if (item.is_unexpected || item.expected_quantity === 0) {
      return 'transparent'
    }

    if (item.received_quantity < item.expected_quantity) {
      return 'rgba(244, 67, 54, 0.05)' // Very light red
    } else if (item.received_quantity === item.expected_quantity) {
      return 'rgba(76, 175, 80, 0.05)' // Very light green
    } else {
      return 'rgba(255, 152, 0, 0.05)' // Very light orange
    }
  }

  return (
    <Box>
      {/* Items Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: '20%' }}>Termék neve</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '10%' }}>Gyártói cikkszám</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Szállított mennyiség</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '10%' }}>Cél mennyiség</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Nettó egységár</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Nettó összesen</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Bruttó összesen</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '2%' }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nincs tétel hozzáadva.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const vatRate = item.vat?.kulcs || 0
                const netPrice = item.unit_cost || 0
                const netTotal = item.received_quantity * netPrice
                const vatAmount = netTotal * (vatRate / 100)
                const grossTotal = netTotal + vatAmount

                const supplierSku = item.product_suppliers?.supplier_sku 
                  || item.products?.model_number 
                  || item.products?.sku 
                  || '-'

                return (
                  <TableRow
                    key={item.id}
                    sx={{
                      backgroundColor: getRowBackgroundColor(item),
                      '&:hover': {
                        backgroundColor: (theme) => {
                          const baseColor = getRowBackgroundColor(item)
                          if (baseColor === 'transparent') return theme.palette.action.hover
                          
                          if (item.received_quantity < item.expected_quantity) {
                            return 'rgba(244, 67, 54, 0.1)'
                          } else if (item.received_quantity === item.expected_quantity) {
                            return 'rgba(76, 175, 80, 0.1)'
                          } else {
                            return 'rgba(255, 152, 0, 0.1)'
                          }
                        }
                      }
                    }}
                  >
                    {/* Termék neve */}
                    <TableCell>
                      {item.products?.name || '-'}
                    </TableCell>
                    
                    {/* Gyártói cikkszám */}
                    <TableCell>
                      {supplierSku}
                    </TableCell>
                    
                    {/* Szállított mennyiség */}
                    <TableCell>
                      {canEdit ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                          <IconButton
                            size="small"
                            onClick={() => updateItemQuantity(index, item.received_quantity - 1)}
                            disabled={item.received_quantity <= 0}
                            sx={{ 
                              width: 32, 
                              height: 32,
                              '&:disabled': {
                                opacity: 0.3
                              }
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <TextField
                            type="number"
                            size="small"
                            value={item.received_quantity === 0 ? '' : item.received_quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value) || 0
                              updateItemQuantity(index, val)
                            }}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{ 
                              width: 100,
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white'
                              }
                            }}
                            placeholder="0"
                          />
                          <IconButton
                            size="small"
                            onClick={() => updateItemQuantity(index, item.received_quantity + 1)}
                            sx={{ 
                              width: 32, 
                              height: 32
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 30, ml: 0.5 }}>
                            {(() => {
                              // Get unit from product or default to 'db'
                              // For now, we'll use 'db' as default since we don't have unit_id in shipment_items
                              return 'db'
                            })()}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'right' }}>
                          {item.received_quantity} db
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Cél mennyiség */}
                    <TableCell align="right">
                      {item.expected_quantity > 0 ? item.expected_quantity : '-'}
                    </TableCell>
                    
                    {/* Nettó egységár */}
                    <TableCell>
                      {canEdit ? (
                        <TextField
                          type="number"
                          size="small"
                          value={item.unit_cost === 0 || item.unit_cost === null ? '' : item.unit_cost}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value) || 0
                            updateItemNetPrice(index, val)
                          }}
                          inputProps={{ min: 0, step: 1 }}
                          sx={{ 
                            width: 120,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white'
                            }
                          }}
                          placeholder="0"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">Ft</InputAdornment>
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'right' }}>
                          {formatNumber(item.unit_cost || 0)} Ft
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Nettó összesen */}
                    <TableCell align="right">
                      {formatCurrency(netTotal)}
                    </TableCell>
                    
                    {/* Bruttó összesen */}
                    <TableCell align="right">
                      {formatCurrency(grossTotal)}
                    </TableCell>
                    
                    {/* Művelet */}
                    <TableCell>
                      {canEdit && item.is_unexpected && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteItem(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
            {addingProduct && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={productSearchResults}
                    getOptionLabel={(option) => `${option.product_name} (${option.product_sku})`}
                    loading={searchingProducts}
                    inputValue={productSearchTerm}
                    onInputChange={(_, newValue) => setProductSearchTerm(newValue)}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        handleAddProduct(newValue)
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Keresés termék név vagy SKU alapján..."
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {searchingProducts ? <CircularProgress size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.product_id}>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {option.product_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            SKU: {option.product_sku} | Beszerzési ár: {formatCurrency(option.cost || 0)}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    noOptionsText={productSearchTerm.length < 2 ? 'Írjon be legalább 2 karaktert' : 'Nincs találat'}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={() => {
                      setAddingProduct(false)
                      setProductSearchTerm('')
                      setProductSearchResults([])
                    }}>
                      Mégse
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {items.length > 0 && (
              <TableRow>
                <TableCell colSpan={4} align="right">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Összesen: {totals.itemCount} tétel, {totals.totalReceived} mennyiség
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.netTotal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatCurrency(totals.grossTotal)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Product Button */}
      {canEdit && (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddingProduct(true)}
          disabled={addingProduct}
          sx={{ mt: 2, alignSelf: 'flex-start' }}
        >
          Új termék hozzáadása
        </Button>
      )}
    </Box>
  )
}

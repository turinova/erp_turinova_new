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
  Select,
  MenuItem,
  FormControl,
  InputAdornment,
  Autocomplete,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Tooltip
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Remove as RemoveIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material'

interface PurchaseOrderItem {
  id?: string // Temporary ID for new items
  product_id: string
  product_name: string
  product_sku: string
  supplier_sku?: string // Gyártói cikkszám (supplier SKU)
  product_supplier_id?: string
  quantity: number
  quantity_received?: number // Beérkezett mennyiség
  unit_cost: number // Nettó ár
  vat_id: string
  unit_id: string
  currency_id?: string
  description?: string
}

interface EditablePurchaseOrderItemsTableProps {
  items: PurchaseOrderItem[]
  onItemsChange: (items: PurchaseOrderItem[]) => void
  vatRates: Array<{ id: string; name: string; rate: number }>
  units: Array<{ id: string; name: string; shortform: string }>
  onProductSearch: (searchTerm: string) => Promise<any[]>
  orderChannels?: Array<{ id: string; channel_type: string; name: string | null; url_template: string | null; description: string | null }>
  canEdit?: boolean // Whether the purchase order can be edited
  showReceivedQuantity?: boolean // Show received quantity column
  poStatus?: string // Purchase order status
  /** When set, prefer this supplier when adding a product (match by supplier_id); if product has no link for this supplier, backend will auto-link on PO save */
  supplierId?: string
}

export default function EditablePurchaseOrderItemsTable({
  items,
  onItemsChange,
  vatRates,
  units,
  onProductSearch,
  orderChannels = [],
  canEdit = true,
  showReceivedQuantity = false,
  poStatus = 'draft',
  supplierId
}: EditablePurchaseOrderItemsTableProps) {
  const shouldShowReceived = showReceivedQuantity && poStatus !== 'draft'
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('') // Local state for editing value
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  // Calculate derived values for an item
  const calculateItemValues = (item: PurchaseOrderItem) => {
    const vatRate = vatRates.find(v => v.id === item.vat_id)?.rate || 0
    const netTotal = item.unit_cost * item.quantity
    const vatAmount = netTotal * (vatRate / 100)
    const grossPrice = item.unit_cost * (1 + vatRate / 100)
    const grossTotal = netTotal + vatAmount

    return {
      vatRate,
      netTotal,
      vatAmount,
      grossPrice,
      grossTotal
    }
  }

  // Validate numeric input
  const validateNumericInput = (value: string): string => {
    // Allow empty string, numbers, and one decimal point
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === '' || regex.test(value)) {
      return value
    }
    return editingValue // Return previous value if invalid
  }

  // Start editing a cell
  const startEditing = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ rowIndex, field })
    // Set initial editing value based on field type
    if (field === 'gross_price') {
      const item = items[rowIndex]
      const vatRate = vatRates.find(v => v.id === item.vat_id)?.rate || 0
      const grossPrice = item.unit_cost * (1 + vatRate / 100)
      setEditingValue(grossPrice.toFixed(2))
    } else if (field === 'unit_cost') {
      setEditingValue(currentValue.toFixed(2))
    } else {
      setEditingValue(currentValue.toString())
    }
  }

  // Save edited value
  const saveEditedValue = (index: number, field: string) => {
    const newItems = [...items]
    const item = newItems[index]
    const value = parseFloat(editingValue) || 0
    
    if (field === 'gross_price') {
      // When bruttó ár is edited, calculate nettó ár backwards
      const currentVatRate = vatRates.find(v => v.id === item.vat_id)?.rate || 0
      const calculatedNetPrice = value / (1 + currentVatRate / 100)
      newItems[index] = { ...item, unit_cost: calculatedNetPrice }
    } else if (field === 'vat_id') {
      // When VAT changes, recalculate bruttó ár from nettó ár
      newItems[index] = { ...item, [field]: editingValue }
    } else {
      // For other fields (quantity, unit_cost), just update
      newItems[index] = { ...item, [field]: value }
    }
    
    onItemsChange(newItems)
    setEditingCell(null)
    setEditingValue('')
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  // Delete item
  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onItemsChange(newItems)
  }

  // Product search
  useEffect(() => {
    if (!productSearchTerm || productSearchTerm.length < 2) {
      setProductSearchResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      setSearchingProducts(true)
      onProductSearch(productSearchTerm)
        .then(results => {
          setProductSearchResults(results || [])
        })
        .catch(err => {
          console.error('Error searching products:', err)
          setProductSearchResults([])
        })
        .finally(() => setSearchingProducts(false))
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [productSearchTerm, onProductSearch])

  // Add product to table
  const handleAddProduct = (product: any) => {
    if (!product) return

    // When supplierId is set (new PO): use only the supplier that matches; if no match, add with no link (backend will auto-link on save). Otherwise use first supplier.
    let supplier: any = null
    if (product.suppliers && product.suppliers.length > 0) {
      if (supplierId) {
        supplier = product.suppliers.find((s: any) => s.supplier_id === supplierId) || null
      } else {
        supplier = product.suppliers[0]
      }
    }

    // Ensure unit_id is set from product, fallback to first unit if not available
    const productUnitId = product.unit_id || null
    const productUnitShortform = product.unit_shortform || null
    const fallbackUnitId = units.length > 0 ? units[0].id : ''
    
    // Verify unit exists in units array - try by ID first, then by shortform
    let validUnitId = fallbackUnitId
    if (productUnitId) {
      const foundUnitById = units.find(u => u.id === productUnitId)
      if (foundUnitById) {
        validUnitId = productUnitId
      } else if (productUnitShortform) {
        // Try to match by shortform as fallback
        const foundUnitByShortform = units.find(u => 
          u.shortform.toLowerCase() === productUnitShortform.toLowerCase()
        )
        if (foundUnitByShortform) {
          validUnitId = foundUnitByShortform.id
          console.log('Matched unit by shortform:', {
            productUnitShortform,
            matchedUnitId: foundUnitByShortform.id,
            matchedShortform: foundUnitByShortform.shortform
          })
        } else {
          console.warn('Product unit not found by ID or shortform:', {
            productUnitId,
            productUnitShortform,
            productName: product.product_name,
            availableUnits: units.map(u => ({ id: u.id, name: u.name, shortform: u.shortform }))
          })
        }
      }
    }

    const newItem: PurchaseOrderItem = {
      id: `temp-${Date.now()}`,
      product_id: product.product_id,
      product_name: product.product_name,
      product_sku: product.product_sku,
      // Use supplier_sku from product_suppliers, fallback to model_number, then product SKU
      supplier_sku: supplier?.supplier_sku || product.model_number || product.product_sku,
      product_supplier_id: supplier?.product_supplier_id,
      quantity: 1,
      unit_cost: (supplier?.default_cost != null && supplier?.default_cost !== '')
        ? Number(supplier.default_cost)
        : (product.cost || 0),
      vat_id: product.vat_id || vatRates[0]?.id || '',
      unit_id: validUnitId,
      currency_id: product.currency_id || ''
    }

    console.log('Added product to PO:', {
      productName: newItem.product_name,
      unitId: newItem.unit_id,
      unitShortform: units.find(u => u.id === newItem.unit_id)?.shortform,
      productUnitId: product.unit_id,
      productUnitShortform: product.unit_shortform
    })

    onItemsChange([...items, newItem])
    
    // Clear search field immediately
    setProductSearchTerm('')
    setProductSearchResults([])
    setSelectedProduct(null)
    
    // Focus on quantity field of new row
    setTimeout(() => {
      startEditing(items.length, 'quantity', 1)
    }, 100)
  }

  // Calculate totals
  const totals = items.reduce((acc, item) => {
    const { netTotal, vatAmount, grossTotal } = calculateItemValues(item)
    acc.netTotal += netTotal
    acc.vatTotal += vatAmount
    acc.grossTotal += grossTotal
    acc.totalQuantity += item.quantity
    acc.itemCount += 1
    return acc
  }, {
    netTotal: 0,
    vatTotal: 0,
    grossTotal: 0,
    totalQuantity: 0,
    itemCount: 0
  })

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

  return (
    <Box>
      {/* Product Search Row */}
      {canEdit && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Autocomplete
            sx={{ flexGrow: 1 }}
            options={productSearchResults}
            getOptionLabel={(option) => `${option.product_name} (${option.product_sku})`}
            loading={searchingProducts}
            value={selectedProduct}
          inputValue={productSearchTerm}
          onInputChange={(_, newValue) => setProductSearchTerm(newValue)}
          onChange={(_, newValue) => {
            if (newValue) {
              handleAddProduct(newValue)
              // Clear selection after adding
              setSelectedProduct(null)
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Keresés termék név vagy SKU alapján..."
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {option.product_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    SKU: {option.product_sku} | Beszerzési ár: {formatCurrency(option.cost || 0)}
                  </Typography>
                </Box>
                {option.has_suppliers && (
                  <Chip
                    label={`${option.supplier_count} beszállító`}
                    size="small"
                    color="primary"
                  />
                )}
              </Box>
            </Box>
          )}
          noOptionsText={productSearchTerm.length < 2 ? 'Írjon be legalább 2 karaktert' : 'Nincs találat'}
        />
        </Box>
      )}

      {/* Items Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: '20%' }}>Termék neve</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '10%' }}>Gyártói cikkszám</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '10%' }}>Mennyiség</TableCell>
              {shouldShowReceived && (
                <TableCell sx={{ fontWeight: 700, width: '10%' }} align="right">Beérkezett</TableCell>
              )}
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Nettó ár</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Bruttó ár</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '10%' }}>ÁFA</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Bruttó</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Részösszeg</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '2%' }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nincs tétel hozzáadva. Keressen terméket a fenti mezőben.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const { vatRate, netTotal, vatAmount, grossPrice, grossTotal } = calculateItemValues(item)
                const isEditing = editingCell?.rowIndex === index

                // Find internet order channel
                const internetChannel = orderChannels.find(ch => ch.channel_type === 'internet' && ch.url_template)
                
                // Build URL for product if internet channel exists
                const buildProductUrl = (sku: string, name: string, supplierSku?: string | null) => {
                  if (!internetChannel?.url_template) return null
                  // Use supplier_sku if available and not empty, otherwise fallback to product SKU
                  // Replace supplier_sku first (more specific), then sku (fallback), then other placeholders
                  const supplierSkuValue = (supplierSku && supplierSku.trim()) ? supplierSku : sku
                  let url = internetChannel.url_template
                  // Replace in order: supplier_sku first, then sku, then name, then ean
                  // This ensures {{supplier_sku}} is replaced before {{sku}} to avoid conflicts
                  if (url.includes('{{supplier_sku}}')) {
                    url = url.replace(/\{\{supplier_sku\}\}/g, encodeURIComponent(supplierSkuValue))
                  }
                  url = url.replace(/\{\{sku\}\}/g, encodeURIComponent(sku))
                  url = url.replace(/\{\{name\}\}/g, encodeURIComponent(name))
                  url = url.replace(/\{\{ean\}\}/g, '') // EAN not available in current item structure
                  return url
                }

                const productUrl = buildProductUrl(item.product_sku, item.product_name, item.supplier_sku)

                return (
                  <TableRow key={item.id || index} hover>
                    {/* Termék neve - Read only with internet link */}
                    <TableCell>
                      {productUrl ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Link
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              color: 'primary.main',
                              textDecoration: 'none',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            {item.product_name}
                            <OpenInNewIcon sx={{ fontSize: '14px' }} />
                          </Link>
                        </Box>
                      ) : (
                        item.product_name
                      )}
                    </TableCell>
                    
                    {/* Gyártói cikkszám - Read only with internet link */}
                    <TableCell>
                      {productUrl ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Link
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              color: 'primary.main',
                              textDecoration: 'none',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            {item.supplier_sku || item.product_sku}
                            <OpenInNewIcon sx={{ fontSize: '14px' }} />
                          </Link>
                        </Box>
                      ) : (
                        item.supplier_sku || item.product_sku
                      )}
                    </TableCell>
                    
                    {/* Mennyiség - Editable */}
                    <TableCell>
                      {canEdit ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              const newQuantity = Math.max(0, item.quantity - 1)
                              const newItems = [...items]
                              newItems[index] = { ...item, quantity: newQuantity }
                              onItemsChange(newItems)
                            }}
                            sx={{ 
                              p: 0.5,
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <TextField
                            type="text"
                            value={isEditing && editingCell?.field === 'quantity' ? editingValue : item.quantity.toString()}
                            onChange={(e) => {
                              if (isEditing && editingCell?.field === 'quantity') {
                                const validated = validateNumericInput(e.target.value)
                                setEditingValue(validated)
                              }
                            }}
                            onClick={() => {
                              if (!isEditing || editingCell?.field !== 'quantity') {
                                startEditing(index, 'quantity', item.quantity)
                              }
                            }}
                            onBlur={() => {
                              if (isEditing && editingCell?.field === 'quantity') {
                                saveEditedValue(index, 'quantity')
                              }
                            }}
                            onKeyDown={(e) => {
                              if (isEditing && editingCell?.field === 'quantity') {
                                if (e.key === 'Enter') {
                                  saveEditedValue(index, 'quantity')
                                } else if (e.key === 'Escape') {
                                  cancelEditing()
                                }
                              }
                            }}
                            onFocus={() => {
                              if (!isEditing || editingCell?.field !== 'quantity') {
                                startEditing(index, 'quantity', item.quantity)
                              }
                            }}
                            autoFocus={isEditing && editingCell?.field === 'quantity'}
                            size="small"
                            inputProps={{ 
                              readOnly: !(isEditing && editingCell?.field === 'quantity'),
                              style: { textAlign: 'right', cursor: isEditing && editingCell?.field === 'quantity' ? 'text' : 'pointer' }
                            }}
                            sx={{ 
                              width: 80,
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white',
                                cursor: isEditing && editingCell?.field === 'quantity' ? 'text' : 'pointer',
                                '&:hover': {
                                  backgroundColor: isEditing && editingCell?.field === 'quantity' ? 'white' : 'action.hover'
                                },
                                '&.Mui-focused': {
                                  backgroundColor: 'white'
                                }
                              },
                              '& .MuiInputBase-input': {
                                cursor: isEditing && editingCell?.field === 'quantity' ? 'text' : 'pointer'
                              }
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              const newQuantity = item.quantity + 1
                              const newItems = [...items]
                              newItems[index] = { ...item, quantity: newQuantity }
                              onItemsChange(newItems)
                            }}
                            sx={{ 
                              p: 0.5,
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 30, ml: 0.5 }}>
                            {(() => {
                              const unit = units.find(u => u.id === item.unit_id)
                              return unit?.shortform || 'db'
                            })()}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'right' }}>
                          {item.quantity} {(() => {
                            const unit = units.find(u => u.id === item.unit_id)
                            return unit?.shortform || 'db'
                          })()}
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Beérkezett mennyiség - Read-only chip */}
                    {shouldShowReceived && (
                      <TableCell align="right">
                        <Chip
                          label={item.quantity_received || 0}
                          size="small"
                          color={
                            (item.quantity_received || 0) === item.quantity
                              ? 'success' // Green - exact match
                              : (item.quantity_received || 0) < item.quantity
                                ? 'error' // Red - less than ordered
                                : 'warning' // Orange - more than ordered
                          }
                          sx={{
                            fontWeight: 600,
                            minWidth: 50,
                            color: 'white',
                            '& .MuiChip-label': {
                              color: 'white'
                            }
                          }}
                        />
                      </TableCell>
                    )}
                    
                    {/* Nettó ár - Editable */}
                    <TableCell>
                      {canEdit ? (
                        <TextField
                          type="text"
                          value={isEditing && editingCell?.field === 'unit_cost' ? editingValue : formatNumber(item.unit_cost)}
                          onChange={(e) => {
                            if (isEditing && editingCell?.field === 'unit_cost') {
                              const validated = validateNumericInput(e.target.value)
                              setEditingValue(validated)
                            }
                          }}
                          onClick={() => {
                            if (!isEditing || editingCell?.field !== 'unit_cost') {
                              startEditing(index, 'unit_cost', item.unit_cost)
                            }
                          }}
                          onFocus={() => {
                            if (!isEditing || editingCell?.field !== 'unit_cost') {
                              startEditing(index, 'unit_cost', item.unit_cost)
                            }
                          }}
                          onBlur={() => {
                            if (isEditing && editingCell?.field === 'unit_cost') {
                              saveEditedValue(index, 'unit_cost')
                            }
                          }}
                          onKeyDown={(e) => {
                            if (isEditing && editingCell?.field === 'unit_cost') {
                              if (e.key === 'Enter') {
                                saveEditedValue(index, 'unit_cost')
                              } else if (e.key === 'Escape') {
                                cancelEditing()
                              }
                            }
                          }}
                          autoFocus={isEditing && editingCell?.field === 'unit_cost'}
                          size="small"
                          inputProps={{ 
                            readOnly: !(isEditing && editingCell?.field === 'unit_cost'),
                            style: { textAlign: 'right', cursor: isEditing && editingCell?.field === 'unit_cost' ? 'text' : 'pointer' }
                          }}
                          sx={{ 
                            width: 150,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white',
                              cursor: isEditing && editingCell?.field === 'unit_cost' ? 'text' : 'pointer',
                              '&:hover': {
                                backgroundColor: isEditing && editingCell?.field === 'unit_cost' ? 'white' : 'action.hover'
                              },
                              '&.Mui-focused': {
                                backgroundColor: 'white'
                              }
                            },
                            '& .MuiInputBase-input': {
                              cursor: isEditing && editingCell?.field === 'unit_cost' ? 'text' : 'pointer'
                            }
                          }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">Ft</InputAdornment>
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'right' }}>
                          {formatNumber(item.unit_cost)} Ft
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Br ár - Editable */}
                    <TableCell>
                      {canEdit ? (
                        <TextField
                          type="text"
                          value={isEditing && editingCell?.field === 'gross_price' ? editingValue : formatNumber(grossPrice)}
                          onChange={(e) => {
                            if (isEditing && editingCell?.field === 'gross_price') {
                              const validated = validateNumericInput(e.target.value)
                              setEditingValue(validated)
                            }
                          }}
                          onClick={() => {
                            if (!isEditing || editingCell?.field !== 'gross_price') {
                              startEditing(index, 'gross_price', grossPrice)
                            }
                          }}
                          onFocus={() => {
                            if (!isEditing || editingCell?.field !== 'gross_price') {
                              startEditing(index, 'gross_price', grossPrice)
                            }
                          }}
                          onBlur={() => {
                            if (isEditing && editingCell?.field === 'gross_price') {
                              saveEditedValue(index, 'gross_price')
                            }
                          }}
                          onKeyDown={(e) => {
                            if (isEditing && editingCell?.field === 'gross_price') {
                              if (e.key === 'Enter') {
                                saveEditedValue(index, 'gross_price')
                              } else if (e.key === 'Escape') {
                                cancelEditing()
                              }
                            }
                          }}
                          autoFocus={isEditing && editingCell?.field === 'gross_price'}
                          size="small"
                          inputProps={{ 
                            readOnly: !(isEditing && editingCell?.field === 'gross_price'),
                            style: { textAlign: 'right', cursor: isEditing && editingCell?.field === 'gross_price' ? 'text' : 'pointer' }
                          }}
                          sx={{ 
                            width: 150,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white',
                              cursor: isEditing && editingCell?.field === 'gross_price' ? 'text' : 'pointer',
                              '&:hover': {
                                backgroundColor: isEditing && editingCell?.field === 'gross_price' ? 'white' : 'action.hover'
                              },
                              '&.Mui-focused': {
                                backgroundColor: 'white'
                              }
                            },
                            '& .MuiInputBase-input': {
                              cursor: isEditing && editingCell?.field === 'gross_price' ? 'text' : 'pointer'
                            }
                          }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">Ft</InputAdornment>
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary', textAlign: 'right' }}>
                          {formatNumber(grossPrice)} Ft
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* ÁFA - Editable (dropdown) */}
                    <TableCell>
                      {canEdit ? (
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select
                            value={item.vat_id}
                            onChange={(e) => {
                              const newVatId = e.target.value as string
                              const newItems = [...items]
                              newItems[index] = { ...newItems[index], vat_id: newVatId }
                              onItemsChange(newItems)
                              // Cancel any active editing state
                              if (editingCell?.rowIndex === index && editingCell?.field === 'vat_id') {
                                setEditingCell(null)
                                setEditingValue('')
                              }
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'action.hover'
                                }
                              },
                              '& .MuiSelect-select': {
                                cursor: 'pointer'
                              }
                            }}
                            renderValue={() => {
                              const selectedVat = vatRates.find(v => v.id === item.vat_id)
                              return selectedVat ? `${selectedVat.rate}%` : ''
                            }}
                          >
                            {vatRates.map((vat) => (
                              <MenuItem key={vat.id} value={vat.id}>
                                {vat.rate}%
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {(() => {
                            const selectedVat = vatRates.find(v => v.id === item.vat_id)
                            return selectedVat ? `${selectedVat.rate}%` : '-'
                          })()}
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Bruttó - Calculated (read-only) */}
                    <TableCell>{formatCurrency(grossPrice)}</TableCell>
                    
                    {/* Részösszeg - Calculated (read-only) */}
                    <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(grossTotal)}</TableCell>
                    
                    {/* Delete button */}
                    <TableCell>
                      {canEdit && (
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
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary Card */}
      {items.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              bgcolor: 'grey.50',
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Összesítő
            </Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3, mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                  Tételszám
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {totals.itemCount}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                  Összmennyiség
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {totals.totalQuantity.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                  Nettó tétel összesen
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {formatCurrency(totals.netTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                  ÁFA tétel összesen
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {formatCurrency(totals.vatTotal)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                pt: 1
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Bruttó összesen
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(totals.grossTotal)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  )
}

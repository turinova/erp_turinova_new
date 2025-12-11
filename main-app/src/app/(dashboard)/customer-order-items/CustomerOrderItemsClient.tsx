'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  Checkbox, 
  TextField, 
  InputAdornment, 
  Breadcrumbs, 
  Link, 
  Chip,
  Pagination,
  CircularProgress,
  Tooltip,
  Button
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon,
  AddShoppingCart as CreatePOIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal'

interface CustomerOrderItem {
  id: string
  product_name: string
  sku: string
  quantity: number
  megjegyzes?: string | null
  status: string
  created_at: string
  updated_at: string
  order_id: string
  shop_order_item_id: string | null
  customer_name: string
  customer_mobile: string | null
  order_number: string
  partner_name: string | null
  partner_id: string | null
  vat_name: string
  vat_percent: number
  unit_price_net: number
  unit_price_gross: number
  total_net: number
  total_vat: number
  total_gross: number
  vat_id: string
  currency_id: string
  product_type: string | null
  accessory_id: string | null
  material_id: string | null
  linear_material_id: string | null
  purchase_order_item_id: string | null
  accessories?: { name: string; sku: string; partners_id: string; base_price: number } | null
  materials?: { name: string; base_price: number; length_mm?: number; width_mm?: number } | null
  linear_materials?: { name: string; base_price: number; length?: number } | null
}

interface Partner {
  id: string
  name: string
}

interface CustomerOrderItemsClientProps {
  initialItems: CustomerOrderItem[]
  initialTotalCount: number
  initialTotalPages: number
  initialCurrentPage: number
  initialLimit: number
  initialSearch: string
  initialStatus: string
  initialPartnerId: string
  partners: Partner[]
}

export default function CustomerOrderItemsClient({ 
  initialItems, 
  initialTotalCount, 
  initialTotalPages, 
  initialCurrentPage, 
  initialLimit, 
  initialSearch, 
  initialStatus, 
  initialPartnerId, 
  partners 
}: CustomerOrderItemsClientProps) {
  const router = useRouter()
  
  const [items, setItems] = useState<CustomerOrderItem[]>(initialItems)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'open')
  const [partnerFilter, setPartnerFilter] = useState(initialPartnerId || '')
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // PO Creation
  const [createPoModalOpen, setCreatePoModalOpen] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch warehouses on mount for PO creation
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/warehouses')
        if (res.ok) {
          const data = await res.json()
          setWarehouses(data.warehouses || [])
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error)
      }
    }
    fetchWarehouses()
  }, [])

  // Color palette for partner rows
  const partnerColors = [
    '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FCE4EC',
    '#F1F8E9', '#E0F2F1', '#FFF9C4', '#FFEBEE', '#E8EAF6',
    '#F9FBE7', '#FBE9E7', '#E1F5FE', '#F3E5F5', '#FFFDE7',
  ]

  const getPartnerColor = (partnerName: string | null | undefined): string => {
    if (!partnerName) return 'transparent'
    let hash = 0
    for (let i = 0; i < partnerName.length; i++) {
      hash = partnerName.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colorIndex = Math.abs(hash) % partnerColors.length
    return partnerColors[colorIndex]
  }

  // Update items when initialItems prop changes
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  // Filter items by search term and status (client-side)
  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchLower) ||
      item.sku?.toLowerCase().includes(searchLower) ||
      item.customer_name?.toLowerCase().includes(searchLower) ||
      item.partner_name?.toLowerCase().includes(searchLower)
    
    // Handle status filter (including 'deleted' for soft-deleted items)
    let matchesStatus = false
    if (statusFilter === '') {
      matchesStatus = true  // Show all (including deleted)
    } else if (statusFilter === 'deleted') {
      matchesStatus = !!item.deleted_at  // Show only soft-deleted
    } else {
      matchesStatus = item.status === statusFilter && !item.deleted_at  // Show by status, exclude deleted
    }
    
    const matchesPartner = !partnerFilter || item.partner_id === partnerFilter
    
    return matchesSearch && matchesStatus && matchesPartner
  })

  // Count items by status (including soft-deleted)
  const statusCounts = {
    all: items.length,
    open: items.filter(i => i.status === 'open' && !i.deleted_at).length,
    in_po: items.filter(i => i.status === 'in_po' && !i.deleted_at).length,
    ordered: items.filter(i => i.status === 'ordered' && !i.deleted_at).length,
    arrived: items.filter(i => i.status === 'arrived' && !i.deleted_at).length,
    handed_over: items.filter(i => i.status === 'handed_over' && !i.deleted_at).length,
    deleted: items.filter(i => i.deleted_at).length
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  const totalPages = Math.ceil(filteredItems.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

  // Check if selected items can create PO (same partner_id and all status is 'open')
  const canCreatePO = React.useMemo(() => {
    if (selectedItems.length === 0) return { canCreate: false, reason: '' }
    
    const selectedItemsData = items.filter(item => selectedItems.includes(item.id))
    const partnerIds = [...new Set(selectedItemsData.map(item => item.partner_id).filter(Boolean))]
    
    // Check if all selected items have status 'open'
    const allOpen = selectedItemsData.every(item => item.status === 'open')
    if (!allOpen) {
      return { canCreate: false, reason: 'Csak nyitott státuszú tételek választhatók ki' }
    }
    
    if (partnerIds.length === 0) {
      return { canCreate: false, reason: 'Nincs beszállító' }
    }
    if (partnerIds.length > 1) {
      return { canCreate: false, reason: 'Több beszállító' }
    }
    
    const partnerName = selectedItemsData[0]?.partner_name || ''
    return { canCreate: true, reason: '', partnerName }
  }, [selectedItems, items])

  // Check if selected items can be deleted (all must have status 'open')
  const canDelete = React.useMemo(() => {
    if (selectedItems.length === 0) return { canDelete: false, reason: '' }
    
    const selectedItemsData = items.filter(item => selectedItems.includes(item.id))
    
    // Check if all selected items have status 'open'
    const allOpen = selectedItemsData.every(item => item.status === 'open')
    if (!allOpen) {
      const nonOpenItems = selectedItemsData.filter(item => item.status !== 'open')
      const statuses = [...new Set(nonOpenItems.map(item => item.status))]
      return { 
        canDelete: false, 
        reason: `Csak nyitott státuszú tételek törölhetők. ${nonOpenItems.length} tétel nem nyitott státuszú (${statuses.join(', ')})` 
      }
    }
    
    return { canDelete: true, reason: '' }
  }, [selectedItems, items])

  if (!mounted) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

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

  const getDisplaySku = (item: CustomerOrderItem): string => {
    if (item.accessory_id && item.accessories?.sku) {
      return item.accessories.sku
    }
    return item.sku || '-'
  }

  const getPurchasePrice = (item: CustomerOrderItem): number | null => {
    if (item.material_id && item.materials) {
      // For materials: base_price * length_mm * width_mm / 1000000 (convert mm² to m²)
      if (item.materials.length_mm && item.materials.width_mm) {
        return Math.round(item.materials.base_price * item.materials.length_mm * item.materials.width_mm / 1000000)
      }
      return item.materials.base_price
    } else if (item.linear_material_id && item.linear_materials) {
      // For linear_materials: base_price * length / 1000 (convert mm to meters)
      if (item.linear_materials.length) {
        return Math.round(item.linear_materials.base_price * item.linear_materials.length / 1000)
      }
      return item.linear_materials.base_price
    } else if (item.accessory_id && item.accessories) {
      // For accessories: just use base_price
      return item.accessories.base_price
    }
    return null
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Nyitott', color: 'warning' as const }
      case 'in_po':
        return { label: 'PO-ban', color: 'info' as const }
      case 'ordered':
        return { label: 'Rendelve', color: 'info' as const }
      case 'arrived':
        return { label: 'Megérkezett', color: 'success' as const }
      case 'handed_over':
        return { label: 'Átadva', color: 'primary' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value)
  }

  const handleSelectAll = () => {
    const filteredIds = paginatedItems.map(item => item.id)
    if (selectedItems.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredIds)
    }
  }

  const handleSelectOne = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
    } else {
      setSelectedItems([...selectedItems, itemId])
    }
  }

  const handleRowClick = (orderId: string) => {
    router.push(`/fulfillment-orders/${orderId}`)
  }

  const handleRefresh = () => {
    router.refresh()
    setSelectedItems([])
  }

  const handleSoftDelete = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Válassz legalább egy tételt')
      return
    }

    // Double-check (safety check, but button should already be disabled)
    if (!canDelete.canDelete) {
      toast.error(canDelete.reason || 'Csak nyitott státuszú tételek törölhetők')
      return
    }

    if (!confirm(`Biztosan törölni szeretnéd a kiválasztott ${selectedItems.length} tételt?`)) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/customer-order-items/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: selectedItems })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Hiba a törlés során')
      }

      toast.success(`${selectedItems.length} tétel törölve`)
      router.refresh()
      setSelectedItems([])
    } catch (error: any) {
      console.error('Error deleting items:', error)
      toast.error(error.message || 'Hiba történt a törlés során')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Beszerzés
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Ügyfél rendelés tételek
        </Typography>
      </Breadcrumbs>
      
      {/* Status Filter Buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => setStatusFilter('')}
          color={statusFilter === '' ? 'primary' : 'default'}
          variant={statusFilter === '' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Nyitott (${statusCounts.open})`}
          onClick={() => setStatusFilter('open')}
          color={statusFilter === 'open' ? 'warning' : 'default'}
          variant={statusFilter === 'open' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`PO-ban (${statusCounts.in_po})`}
          onClick={() => setStatusFilter('in_po')}
          color={statusFilter === 'in_po' ? 'info' : 'default'}
          variant={statusFilter === 'in_po' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Rendelve (${statusCounts.ordered})`}
          onClick={() => setStatusFilter('ordered')}
          color={statusFilter === 'ordered' ? 'info' : 'default'}
          variant={statusFilter === 'ordered' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Megérkezett (${statusCounts.arrived})`}
          onClick={() => setStatusFilter('arrived')}
          color={statusFilter === 'arrived' ? 'success' : 'default'}
          variant={statusFilter === 'arrived' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Átadva (${statusCounts.handed_over})`}
          onClick={() => setStatusFilter('handed_over')}
          color={statusFilter === 'handed_over' ? 'primary' : 'default'}
          variant={statusFilter === 'handed_over' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.deleted})`}
          onClick={() => setStatusFilter('deleted')}
          color={statusFilter === 'deleted' ? 'error' : 'default'}
          variant={statusFilter === 'deleted' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      <TextField
        fullWidth
        placeholder="Keresés ügyfél neve, termék neve vagy SKU szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedItems.length} kijelölve):
          </Typography>
          {canCreatePO.canCreate && (
            <Tooltip title={`Beszerzési rendelés létrehozása - ${canCreatePO.partnerName}`}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CreatePOIcon />}
                onClick={() => setCreatePoModalOpen(true)}
                disabled={isLoading}
                size="small"
              >
                PO Létrehozása ({selectedItems.length})
              </Button>
            </Tooltip>
          )}
          {!canCreatePO.canCreate && selectedItems.length > 0 && canCreatePO.reason && (
            <Tooltip title={`PO nem hozható létre: ${canCreatePO.reason}`}>
              <span>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<CreatePOIcon />}
                  disabled
                  size="small"
                >
                  PO Létrehozása
                </Button>
              </span>
            </Tooltip>
          )}
          {canDelete.canDelete ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleSoftDelete}
              disabled={isLoading}
              size="small"
            >
              Törlés ({selectedItems.length})
            </Button>
          ) : (
            <Tooltip title={canDelete.reason || 'Csak nyitott státuszú tételek törölhetők'}>
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled
                  size="small"
                >
                  Törlés ({selectedItems.length})
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      )}
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                  indeterminate={selectedItems.length > 0 && selectedItems.length < filteredItems.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell><strong>Partner</strong></TableCell>
              <TableCell><strong>Ügyfél neve</strong></TableCell>
              <TableCell><strong>Termék neve</strong></TableCell>
              <TableCell><strong>SKU</strong></TableCell>
              <TableCell align="right"><strong>Mennyiség</strong></TableCell>
              <TableCell><strong>Megjegyzés</strong></TableCell>
              <TableCell align="right"><strong>Beszerzési ár</strong></TableCell>
              <TableCell align="right"><strong>Bruttó egységár</strong></TableCell>
              <TableCell align="right"><strong>Bruttó összesen</strong></TableCell>
              <TableCell><strong>Státusz</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm || statusFilter || partnerFilter ? 'Nincs találat' : 'Még nincs termék'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => {
                const isSelected = selectedItems.includes(item.id)
                const statusInfo = getStatusInfo(item.status)
                const partnerColor = getPartnerColor(item.partner_name)
                
                return (
                  <TableRow
                    key={item.id}
                    hover
                    selected={isSelected}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: partnerColor,
                      '&:hover': {
                        backgroundColor: partnerColor ? `${partnerColor}dd` : undefined,
                      },
                      '&.Mui-selected': {
                        backgroundColor: partnerColor ? `${partnerColor}bb` : undefined,
                      }
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => handleSelectOne(item.id, e)}
                      />
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.partner_name || '-'}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      <Box>
                        <Typography variant="body2">
                          {item.customer_name}
                        </Typography>
                        {item.customer_mobile && (
                          <Typography variant="caption" color="text.secondary">
                            {item.customer_mobile}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2">
                        {getDisplayName(item)}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2">
                        {getDisplaySku(item)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2">
                        {item.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.megjegyzes ? (
                        <Tooltip title={item.megjegyzes} arrow placement="top">
                          <InfoIcon fontSize="small" color="primary" />
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2" fontWeight="bold" color="primary.main">
                        {(() => {
                          const purchasePrice = getPurchasePrice(item)
                          return purchasePrice !== null ? formatCurrency(purchasePrice) : '-'
                        })()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2">
                        {formatCurrency(item.unit_price_gross)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(item.order_id)}>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(item.total_gross)}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      <Chip
                        label={statusInfo.label}
                        color={statusInfo.color}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      {/* Create PO Modal */}
      <CreatePurchaseOrderModal
        open={createPoModalOpen}
        onClose={() => setCreatePoModalOpen(false)}
        selectedItems={items.filter(item => selectedItems.includes(item.id))}
        warehouses={warehouses}
        onSuccess={handleRefresh}
      />
    </Box>
  )
}


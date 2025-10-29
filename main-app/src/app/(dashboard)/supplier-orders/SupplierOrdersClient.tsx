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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextareaAutosize
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon,
  Info as InfoIcon,
  ShoppingCart as OrderedIcon,
  CheckCircle as ArrivedIcon,
  Warning as OpenIcon,
  Delete as DeleteIcon,
  Description as TextIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface ShopOrderItem {
  id: string
  product_name: string
  sku: string
  quantity: number
  megjegyzes: string | null
  status: string
  created_at: string
  updated_at: string
  order_id: string
  customer_name: string
  order_number: string
  unit_name: string
  unit_shortform: string
  partner_name: string
  partner_id: string
  vat_name: string
  vat_percent: number
  base_price: number
  multiplier: number
  gross_unit_price: number
  gross_total: number
}

interface Partner {
  id: string
  name: string
}

interface SupplierOrdersClientProps {
  initialItems: ShopOrderItem[]
  initialTotalCount: number
  initialTotalPages: number
  initialCurrentPage: number
  initialLimit: number
  initialSearch: string
  initialStatus: string
  initialPartnerId: string
  partners: Partner[]
}

export default function SupplierOrdersClient({ 
  initialItems, 
  initialTotalCount, 
  initialTotalPages, 
  initialCurrentPage, 
  initialLimit, 
  initialSearch, 
  initialStatus, 
  initialPartnerId, 
  partners 
}: SupplierOrdersClientProps) {
  const router = useRouter()
  
  const [items, setItems] = useState<ShopOrderItem[]>(initialItems)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'open')
  const [partnerFilter, setPartnerFilter] = useState(initialPartnerId || '')
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false)
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [textGenerationModalOpen, setTextGenerationModalOpen] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  
  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  // Update items when initialItems prop changes (from server-side search)
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  // Filter items by search term and status (client-side) - like customer orders page
  const filteredItems = items.filter(item => {
    // Filter by search term - using optional chaining for null-safety
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      item.product_name?.toLowerCase().includes(searchLower) ||
      item.sku?.toLowerCase().includes(searchLower) ||
      item.customer_name?.toLowerCase().includes(searchLower) ||
      item.partner_name?.toLowerCase().includes(searchLower)
    
    // Filter by status
    const matchesStatus = statusFilter === '' || item.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Count items by status - like orders page
  const statusCounts = {
    all: items.length,
    open: items.filter(i => i.status === 'open').length,
    ordered: items.filter(i => i.status === 'ordered').length,
    arrived: items.filter(i => i.status === 'arrived').length,
    deleted: items.filter(i => i.status === 'deleted').length
  }

  // Pagination - now works with filtered items like customer orders page
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  const totalPages = Math.ceil(filteredItems.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize)

  // Don't render until mounted (avoid hydration errors)
  if (!mounted) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  // Format currency with thousands separator
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'open':
        return { label: 'Nyitott', color: 'warning' as const }
      case 'ordered':
        return { label: 'Rendelve', color: 'info' as const }
      case 'arrived':
        return { label: 'Megérkezett', color: 'success' as const }
      case 'deleted':
        return { label: 'Törölve', color: 'error' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value)
  }

  // Handle limit change
  const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(event.target.value, 10)
    setPageSize(newLimit)
    setCurrentPage(1) // Reset to first page when changing limit
  }

  // Handle row click (navigate to customer order detail page)
  const handleRowClick = (orderId: string) => {
    router.push(`/customer-orders/${orderId}`)
  }

  // Handle select all (only filtered items)
  const handleSelectAll = () => {
    const filteredIds = paginatedItems.map(item => item.id)
    if (selectedItems.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredIds)
    }
  }

  // Handle select one
  const handleSelectOne = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
    } else {
      setSelectedItems([...selectedItems, itemId])
    }
  }

  // Handle bulk status update
  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedItems.length === 0) {
      toast.warning('Válassz legalább egy terméket')
      return
    }

    setPendingStatusUpdate(newStatus)
    setConfirmationModalOpen(true)
  }

  // Confirm bulk status update
  const confirmBulkStatusUpdate = async () => {
    if (!pendingStatusUpdate || selectedItems.length === 0) return

    setIsUpdating(true)
    setConfirmationModalOpen(false)

    try {
      const response = await fetch('/api/supplier-orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: selectedItems,
          new_status: pendingStatusUpdate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update items')
      }

      const result = await response.json()
      
      const statusLabel = getStatusInfo(pendingStatusUpdate).label
      toast.success(`${result.updated_count} termék frissítve: ${statusLabel}`)

      // Reload the page to get fresh data
      router.refresh()
      setSelectedItems([])

    } catch (error) {
      console.error('Error updating items:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a frissítés során')
    } finally {
      setIsUpdating(false)
      setPendingStatusUpdate(null)
    }
  }

  // Cancel bulk status update
  const cancelBulkStatusUpdate = () => {
    setConfirmationModalOpen(false)
    setPendingStatusUpdate(null)
  }

  // Handle text generation
  const handleTextGeneration = () => {
    if (selectedItems.length === 0) {
      toast.warning('Válassz legalább egy terméket')
      return
    }

    // Get selected items data
    const selectedItemsData = items.filter(item => selectedItems.includes(item.id))
    
    // Generate the text
    let text = 'Kedves\n\nA következő termékeket szeretném megrendelni:\n\n'
    
    selectedItemsData.forEach((item, index) => {
      text += `${index + 1}. ${item.product_name} - ${item.sku} - ${item.quantity} ${item.unit_shortform}\n`
    })
    
    setGeneratedText(text)
    setTextGenerationModalOpen(true)
  }

  // Handle copy text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      toast.success('Szöveg másolva a vágólapra')
    } catch (error) {
      console.error('Failed to copy text:', error)
      toast.error('Hiba történt a másolás során')
    }
  }

  // Close text generation modal
  const closeTextGenerationModal = () => {
    setTextGenerationModalOpen(false)
    setGeneratedText('')
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
          Beszállítói rendelések
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
          label={`Törölve (${statusCounts.deleted})`}
          onClick={() => setStatusFilter('deleted')}
          color={statusFilter === 'deleted' ? 'error' : 'default'}
          variant={statusFilter === 'deleted' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Partner Filter - REMOVED */}
      {/* <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Partner</InputLabel>
          <Select
            value={partnerFilter}
            label="Partner"
            onChange={(e) => setPartnerFilter(e.target.value)}
          >
            <MenuItem value="">
              <em>Összes partner</em>
            </MenuItem>
            {partners.map((partner) => (
              <MenuItem key={partner.id} value={partner.id}>
                {partner.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box> */}

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
          <Button
            variant="contained"
            color="success"
            startIcon={<OrderedIcon />}
            onClick={() => handleBulkStatusUpdate('ordered')}
            disabled={isUpdating}
            size="small"
          >
            Megrendel
          </Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<ArrivedIcon />}
            onClick={() => handleBulkStatusUpdate('arrived')}
            disabled={isUpdating}
            size="small"
          >
            Megérkezett
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<OpenIcon />}
            onClick={() => handleBulkStatusUpdate('open')}
            disabled={isUpdating}
            size="small"
          >
            Nyitott
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleBulkStatusUpdate('deleted')}
            disabled={isUpdating}
            size="small"
          >
            Töröl
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<TextIcon />}
            onClick={handleTextGeneration}
            disabled={isUpdating}
            size="small"
          >
            Szöveg generálás
          </Button>
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
              <TableCell align="right"><strong>Bruttó egységár</strong></TableCell>
              <TableCell><strong>Státusz</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm || statusFilter || partnerFilter ? 'Nincs találat' : 'Még nincs termék'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => {
                const isSelected = selectedItems.includes(item.id)
                const statusInfo = getStatusInfo(item.status)
                
                return (
                  <TableRow
                    key={item.id}
                    hover
                    selected={isSelected}
                    sx={{ 
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => handleSelectOne(item.id, e)}
                      />
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.partner_name}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.customer_name}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.product_name}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(item.order_id)}>
                      {item.sku}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(item.order_id)}>
                      {item.quantity} {item.unit_shortform}
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
                      {formatCurrency(item.gross_unit_price)}
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
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || statusFilter !== '' 
              ? `Keresési eredmény: ${filteredItems.length} termék` 
              : `Összesen ${items.length} termék`
            }
          </Typography>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={pageSize}
              onChange={handleLimitChange}
              displayEmpty
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Oldal mérete
          </Typography>
        </Box>
        
        <Pagination
          count={totalPages}
          page={currentPage}
          onChange={handlePageChange}
          color="primary"
          disabled={isLoading}
          showFirstButton
          showLastButton
        />
      </Box>

      {/* Confirmation Modal */}
      <Dialog
        open={confirmationModalOpen}
        onClose={cancelBulkStatusUpdate}
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <DialogTitle id="confirmation-dialog-title">
          Státusz frissítés megerősítése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirmation-dialog-description">
            Biztosan frissíteni szeretnéd {selectedItems.length} termék státuszát "{getStatusInfo(pendingStatusUpdate || '').label}" státuszra?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelBulkStatusUpdate} disabled={isUpdating}>
            Mégse
          </Button>
          <Button 
            onClick={confirmBulkStatusUpdate} 
            autoFocus 
            disabled={isUpdating}
            color="primary"
            variant="contained"
          >
            {isUpdating ? 'Frissítés...' : 'Megerősítés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Text Generation Modal */}
      <Dialog
        open={textGenerationModalOpen}
        onClose={closeTextGenerationModal}
        maxWidth="md"
        fullWidth
        aria-labelledby="text-generation-dialog-title"
      >
        <DialogTitle id="text-generation-dialog-title">
          Szöveg generálás
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A kiválasztott termékek alapján generált szöveg:
            </Typography>
            <TextareaAutosize
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              minRows={10}
              maxRows={20}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: '1.5',
                resize: 'vertical'
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTextGenerationModal}>
            Mégse
          </Button>
          <Button 
            onClick={handleCopyText}
            variant="contained"
            startIcon={<CopyIcon />}
            color="primary"
          >
            Másolás
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

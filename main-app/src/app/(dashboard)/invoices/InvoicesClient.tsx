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
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Chip,
  Pagination,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material'
import NextLink from 'next/link'
import { Search as SearchIcon, Home as HomeIcon, PictureAsPdf as PictureAsPdfIcon, Undo as UndoIcon } from '@mui/icons-material'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast } from 'react-toastify'

interface InvoiceRow {
  id: string
  internal_number: string
  provider_invoice_number: string | null
  invoice_type: string
  payment_due_date: string | null
  fulfillment_date: string | null
  gross_total: number | null
  payment_status: string | null
  pdf_url: string | null
  is_storno_of_invoice_id: string | null
  related_order_type: string
  related_order_id: string | null
  related_order_number: string | null
  customer_id: string | null
  customer_name: string | null
  deleted_at: string | null
  created_at?: string
}

interface InvoicesClientProps {
  initialInvoices: InvoiceRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialInvoiceTypeFilter?: string
  initialPageSize?: number
  invoiceTypeCounts?: {
    all: number
    szamla: number
    elolegszamla: number
    dijbekero: number
    sztorno: number
  }
}

export default function InvoicesClient({
  initialInvoices,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialInvoiceTypeFilter = 'all',
  initialPageSize = 50,
  invoiceTypeCounts = {
    all: 0,
    szamla: 0,
    elolegszamla: 0,
    dijbekero: 0,
    sztorno: 0
  }
}: InvoicesClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionLoading } = usePagePermission('/invoices')
  
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState(initialInvoiceTypeFilter || 'all')
  const [mounted, setMounted] = useState(false)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false)
  const [stornoTarget, setStornoTarget] = useState<InvoiceRow | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Debounced search effect - triggers server-side search
  useEffect(() => {
    if (!mounted) return

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('page', '1') // Reset to first page when searching
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
        params.set('invoiceType', invoiceTypeFilter)
      }
      router.push(`/invoices?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, invoiceTypeFilter, mounted, router])

  // Update invoices when initialInvoices prop changes (from server-side search)
  useEffect(() => {
    setInvoices(initialInvoices)
    setClientPage(currentPage)
  }, [initialInvoices, currentPage])


  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
      params.set('invoiceType', invoiceTypeFilter)
    }
    router.push(`/invoices?${params.toString()}`)
  }

  // Handle page size change
  const handleLimitChange = (event: any) => {
    setPageSize(event.target.value)
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', event.target.value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
      params.set('invoiceType', invoiceTypeFilter)
    }
    router.push(`/invoices?${params.toString()}`)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  const getOrderLink = (invoice: InvoiceRow): string | null => {
    if (!invoice.related_order_id) return null
    
    switch (invoice.related_order_type) {
      case 'pos_order':
        return `/pos-orders/${invoice.related_order_id}`
      case 'customer_order':
        return `/fulfillment-orders/${invoice.related_order_id}`
      case 'quote':
        return `/orders/${invoice.related_order_id}`
      default:
        return null
    }
  }

  const handleOpenStornoDialog = (invoice: InvoiceRow) => {
    setStornoTarget(invoice)
    setStornoDialogOpen(true)
  }

  const handleCloseStornoDialog = () => {
    setStornoDialogOpen(false)
    setStornoTarget(null)
  }

  const handleConfirmStorno = async () => {
    if (!stornoTarget?.provider_invoice_number || !stornoTarget?.id) {
      toast.error('Hiányzik a számlaszám a sztornóhoz')
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`/api/invoices/${stornoTarget.id}/storno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerInvoiceNumber: stornoTarget.provider_invoice_number })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Hiba a sztornó számla létrehozásakor')
      }
      toast.success(`Sztornó számla létrehozva: ${data.invoiceNumber || 'N/A'}`)
      handleCloseStornoDialog()
      router.refresh()
    } catch (err: any) {
      console.error('Error creating storno invoice:', err)
      toast.error(err.message || 'Hiba a sztornó számla létrehozásakor')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenInvoicePdf = (invoice: InvoiceRow) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank', 'noopener')
    } else {
      toast.info('Nincs PDF elérési út ehhez a számlához')
    }
  }

  if (permissionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Nincs jogosultsága az oldal megtekintéséhez.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/home" underline="hover" color="inherit">
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Kimenő számlák</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Kimenő számlák
      </Typography>

      {/* Invoice Type Filter Chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${invoiceTypeCounts.all})`}
          onClick={() => {
            setInvoiceTypeFilter('all')
            const params = new URLSearchParams()
            params.set('page', '1')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/invoices?${params.toString()}`)
          }}
          color={invoiceTypeFilter === 'all' ? 'primary' : 'default'}
          variant={invoiceTypeFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Számla (${invoiceTypeCounts.szamla})`}
          onClick={() => {
            setInvoiceTypeFilter('szamla')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('invoiceType', 'szamla')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/invoices?${params.toString()}`)
          }}
          color={invoiceTypeFilter === 'szamla' ? 'primary' : 'default'}
          variant={invoiceTypeFilter === 'szamla' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Előleg számla (${invoiceTypeCounts.elolegszamla})`}
          onClick={() => {
            setInvoiceTypeFilter('elolegszamla')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('invoiceType', 'elolegszamla')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/invoices?${params.toString()}`)
          }}
          color={invoiceTypeFilter === 'elolegszamla' ? 'warning' : 'default'}
          variant={invoiceTypeFilter === 'elolegszamla' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Díjbekérő (${invoiceTypeCounts.dijbekero})`}
          onClick={() => {
            setInvoiceTypeFilter('dijbekero')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('invoiceType', 'dijbekero')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/invoices?${params.toString()}`)
          }}
          color={invoiceTypeFilter === 'dijbekero' ? 'info' : 'default'}
          variant={invoiceTypeFilter === 'dijbekero' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Sztornó (${invoiceTypeCounts.sztorno})`}
          onClick={() => {
            setInvoiceTypeFilter('sztorno')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('invoiceType', 'sztorno')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/invoices?${params.toString()}`)
          }}
          color={invoiceTypeFilter === 'sztorno' ? 'error' : 'default'}
          variant={invoiceTypeFilter === 'sztorno' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés számlaszám, ügyfél név vagy ügyfél ID szerint..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Számla azonosító</TableCell>
                <TableCell>Számla ID</TableCell>
                <TableCell>Számla típusa</TableCell>
                <TableCell>Ügyfél</TableCell>
                <TableCell>Kapcsolódó rendelés</TableCell>
                <TableCell>Fizetési határidő</TableCell>
                <TableCell>Teljesítési dátum</TableCell>
                <TableCell align="right">Bruttó összeg</TableCell>
                <TableCell>Fizetési állapot</TableCell>
                <TableCell align="right">Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    Nincs megjeleníthető számla.
                  </TableCell>
                </TableRow>
              ) : invoices.map(inv => {
                const orderLink = getOrderLink(inv)
                const isDeleted = !!inv.deleted_at
                return (
                  <TableRow 
                    key={inv.id}
                    sx={{
                      opacity: isDeleted ? 0.6 : 1,
                      textDecoration: isDeleted ? 'line-through' : 'none'
                    }}
                  >
                    <TableCell>{inv.internal_number}</TableCell>
                    <TableCell>{inv.provider_invoice_number || '-'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {inv.invoice_type ? (
                          <Chip
                            label={
                              inv.invoice_type === 'szamla'
                                ? 'Számla'
                                : inv.invoice_type === 'elolegszamla'
                                ? 'Előleg számla'
                                : inv.invoice_type === 'dijbekero'
                                ? 'Díjbekérő'
                                : inv.invoice_type === 'sztorno'
                                ? 'Sztornó'
                                : inv.invoice_type
                            }
                            size="small"
                            color={
                              inv.invoice_type === 'sztorno' 
                                ? 'error' 
                                : inv.invoice_type === 'elolegszamla' 
                                ? 'warning' 
                                : inv.invoice_type === 'dijbekero'
                                ? 'info'
                                : 'primary'
                            }
                            variant="outlined"
                          />
                        ) : (
                          '-'
                        )}
                        {isDeleted && (
                          <Chip
                            label="Törölve"
                            size="small"
                            color="error"
                            variant="filled"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{inv.customer_name || '-'}</TableCell>
                    <TableCell>
                      {orderLink && inv.related_order_number ? (
                        <Link component={NextLink} href={orderLink} color="primary">
                          {inv.related_order_number}
                        </Link>
                      ) : inv.related_order_number ? (
                        inv.related_order_number
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{inv.payment_due_date || '-'}</TableCell>
                    <TableCell>{inv.fulfillment_date || '-'}</TableCell>
                    <TableCell align="right">{inv.gross_total != null ? formatCurrency(Number(inv.gross_total)) : '-'}</TableCell>
                    <TableCell>
                      {inv.payment_status ? (
                        <Chip
                          label={
                            inv.payment_status === 'nem_lesz_fizetve'
                              ? 'Nem lesz fizetve'
                              : inv.payment_status === 'fizetve'
                              ? 'Fizetve'
                              : inv.payment_status === 'fizetesre_var'
                              ? 'Fizetésre vár'
                              : inv.payment_status
                          }
                          size="small"
                          color={
                            inv.payment_status === 'fizetve'
                              ? 'success'
                              : inv.payment_status === 'fizetesre_var'
                              ? 'warning'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Sztornó számla">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={inv.invoice_type === 'sztorno' || isDeleted}
                              onClick={() => handleOpenStornoDialog(inv)}
                            >
                              <UndoIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="PDF megnyitás">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenInvoicePdf(inv)}
                              disabled={!inv.pdf_url || isDeleted}
                            >
                              <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {searchTerm
            ? `Keresési eredmény: ${totalCount} számla` 
            : `Összesen ${totalCount} számla`
          }
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          page={clientPage}
          onChange={handlePageChange}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>

      {/* Sztornó megerősítés */}
      <Dialog open={stornoDialogOpen} onClose={handleCloseStornoDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Sztornó számla</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan létrehozod a sztornó számlát a következő számlához?
          </Typography>
          <Typography sx={{ mt: 1 }} fontWeight="bold">
            {stornoTarget?.provider_invoice_number || '-'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStornoDialog} disabled={loading}>Mégse</Button>
          <Button color="error" variant="contained" onClick={handleConfirmStorno} disabled={loading}>
            {loading ? 'Feldolgozás...' : 'Sztornó létrehozása'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}


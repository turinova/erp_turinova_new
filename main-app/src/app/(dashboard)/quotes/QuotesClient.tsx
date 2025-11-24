'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  CircularProgress,
  Pagination,
  Chip
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'

interface Quote {
  id: string
  quote_number: string
  status: string
  source: string
  customer_name: string
  payment_method_id: string | null
  payment_method_name: string | null
  final_total_after_discount: number
  updated_at: string
}

interface QuotesClientProps {
  initialQuotes: Quote[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
}

export default function QuotesClient({ 
  initialQuotes, 
  totalCount, 
  totalPages, 
  currentPage, 
  initialSearchTerm 
}: QuotesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Check permission for this page
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/quotes')
  
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes)
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Ensure client-side only rendering for buttons to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update quotes when initialQuotes prop changes (from server-side search/filter)
  useEffect(() => {
    setQuotes(initialQuotes)
  }, [initialQuotes])

  // Debounced search effect - triggers server-side search (like orders page)
  useEffect(() => {
    if (!mounted) return

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('page', '1') // Reset to first page when searching
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      router.push(`/quotes?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, mounted, router])

  // Format currency with thousands separator
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date-time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedQuotes(quotes.map(quote => quote.id))
    } else {
      setSelectedQuotes([])
    }
  }

  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuotes(prev => 
      prev.includes(quoteId) 
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    )
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      // Trigger immediate search (bypass debounce)
      const params = new URLSearchParams()
      params.set('page', '1')
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      router.push(`/quotes?${params.toString()}`)
    }
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams()
    params.set('page', page.toString())
    // Always include search param if it exists
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/quotes?${params.toString()}`)
  }

  const handleDeleteClick = () => {
    if (selectedQuotes.length === 0) {
      toast.error('Nincs kiválasztott árajánlat')
      return
    }
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/quotes/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quoteIds: selectedQuotes })
      })

      if (!response.ok) {
        throw new Error('Failed to delete quotes')
      }

      toast.success(`${selectedQuotes.length} árajánlat sikeresen törölve`)
      setSelectedQuotes([])
      setDeleteDialogOpen(false)
      
      // Refresh the page to show updated data
      router.refresh()
      
    } catch (error) {
      console.error('Error deleting quotes:', error)
      toast.error('Hiba az árajánlatok törlése során')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const isAllSelected = selectedQuotes.length === quotes.length && quotes.length > 0
  const isIndeterminate = selectedQuotes.length > 0 && selectedQuotes.length < quotes.length

  // Check access permission
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága az Árajánlatok oldal megtekintéséhez!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/home')
      }, 100) // Small delay to prevent redirects during page refresh
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Árajánlatok oldal megtekintéséhez!
        </Typography>
      </Box>
    )
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
          Eszközök
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Árajánlatok
        </Typography>
      </Breadcrumbs>
      
      {mounted && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {/* Left side: Empty for now */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Future: Export/Import buttons can go here */}
          </Box>

          {/* Right side: Delete button */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={selectedQuotes.length === 0}
            >
              Törlés ({selectedQuotes.length})
            </Button>
          </Box>
        </Box>
      )}
      
      <TextField
        fullWidth
        placeholder="Keresés ügyfél nevében..."
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
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Árajánlat szám</TableCell>
              <TableCell>Ügyfél</TableCell>
              <TableCell>Forrás</TableCell>
              <TableCell>Fizetési mód</TableCell>
              <TableCell align="right">Végösszeg</TableCell>
              <TableCell>Frissítve</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow 
                key={quote.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => router.push(`/quotes/${quote.id}`)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedQuotes.includes(quote.id)}
                    onChange={() => handleSelectQuote(quote.id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {quote.quote_number}
                  </Typography>
                </TableCell>
                <TableCell>{quote.customer_name}</TableCell>
                <TableCell>
                  <Chip 
                    label={quote.source === 'customer_portal' ? 'Ügyfél' : 'Admin'}
                    color={quote.source === 'customer_portal' ? 'info' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {quote.payment_method_name ? (
                    <Chip 
                      label={quote.payment_method_name}
                      color="error"
                      size="small"
                    />
                  ) : (
                    <Typography variant="body2">-</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(quote.final_total_after_discount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(quote.updated_at)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
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
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Árajánlatok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedQuotes.length} árajánlatot? Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Mégse
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

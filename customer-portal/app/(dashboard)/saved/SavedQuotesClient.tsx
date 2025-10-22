'use client'

import React, { useState, useEffect } from 'react'
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
  Alert
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface PortalQuote {
  id: string
  quote_number: string
  final_total_after_discount: number
  updated_at: string
}

interface SavedQuotesClientProps {
  initialQuotes: PortalQuote[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
}

export default function SavedQuotesClient({ 
  initialQuotes, 
  totalCount, 
  totalPages, 
  currentPage, 
  initialSearchTerm 
}: SavedQuotesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [quotes, setQuotes] = useState<PortalQuote[]>(initialQuotes)
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Ensure client-side only rendering for buttons to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Handle select all checkbox
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedQuotes(quotes.map(q => q.id))
    } else {
      setSelectedQuotes([])
    }
  }

  // Handle individual checkbox
  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuotes(prev => 
      prev.includes(quoteId) 
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    )
  }

  // Handle search
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    params.set('page', '1') // Reset to first page on new search
    
    router.push(`/saved?${params.toString()}`)
  }

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/saved?${params.toString()}`)
  }

  // Handle delete
  const handleDelete = async () => {
    if (selectedQuotes.length === 0) {
      toast.error('Nincs kiválasztott árajánlat')
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch('/api/portal-quotes/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteIds: selectedQuotes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete quotes')
      }

      const result = await response.json()

      toast.success(`${selectedQuotes.length} árajánlat sikeresen törölve`)
      setSelectedQuotes([])
      setDeleteDialogOpen(false)

      // Refresh the page to update counts and data
      router.refresh()

    } catch (err) {
      console.error('[Customer Portal] Error deleting quotes:', err)
      toast.error('Hiba az árajánlatok törlése során')
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle row click (navigate to quote detail)
  const handleRowClick = (quoteId: string) => {
    router.push(`/saved/${quoteId}`)
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          underline="hover"
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          color="inherit"
          onClick={() => router.push('/home')}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Mentések</Typography>
      </Breadcrumbs>

      {/* Page Title & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Mentett árajánlataim
        </Typography>

        {mounted && selectedQuotes.length > 0 && (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Kijelöltek törlése ({selectedQuotes.length})
          </Button>
        )}
      </Box>

      {/* Search */}
      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés árajánlat szám alapján..."
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
      </Box>

      {/* Quotes Table */}
      {quotes.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {searchTerm ? 'Nincs találat a keresési feltételeknek megfelelően.' : 'Még nincs mentett árajánlata.'}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {mounted && (
                      <Checkbox
                        checked={selectedQuotes.length === quotes.length && quotes.length > 0}
                        indeterminate={selectedQuotes.length > 0 && selectedQuotes.length < quotes.length}
                        onChange={handleSelectAll}
                      />
                    )}
                  </TableCell>
                  <TableCell>Árajánlat szám</TableCell>
                  <TableCell align="right">Végösszeg</TableCell>
                  <TableCell>Utolsó módosítás</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow
                    key={quote.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(quote.id)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      {mounted && (
                        <Checkbox
                          checked={selectedQuotes.includes(quote.id)}
                          onChange={() => handleSelectQuote(quote.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {quote.quote_number}
                      </Typography>
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

          {/* Results Summary */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Összesen {totalCount} árajánlat
          </Typography>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Árajánlatok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kijelölt {selectedQuotes.length} árajánlatot?
            Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            Mégse
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={20} /> : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}


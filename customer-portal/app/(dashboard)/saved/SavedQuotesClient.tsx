'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import Pagination from '@mui/material/Pagination'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Delete as DeleteIcon, Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { PortalTypeChip } from '@/components/portal-list/PortalTypeChip'
import { QuoteCommentIcon } from '@/components/portal-list/QuoteCommentIcon'
import {
  formatPortalCurrency,
  formatPortalDateTime,
  type PortalQuoteType
} from '@/lib/portal-list-labels'

interface PortalQuote {
  id: string
  quote_number: string
  comment?: string | null
  final_total_after_discount: number
  updated_at: string
  type?: PortalQuoteType
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

  useEffect(() => {
    setQuotes(initialQuotes)
  }, [initialQuotes])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedQuotes(quotes.map(q => q.id))
    } else {
      setSelectedQuotes([])
    }
  }

  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuotes(prev =>
      prev.includes(quoteId) ? prev.filter(id => id !== quoteId) : [...prev, quoteId]
    )
  }

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    params.set('page', '1')
    router.push(`/saved?${params.toString()}`)
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/saved?${params.toString()}`)
  }

  const handleDelete = async () => {
    if (selectedQuotes.length === 0) {
      toast.error('Nincs kiválasztott árajánlat')
      return
    }

    setIsDeleting(true)

    try {
      const optiIds = selectedQuotes.filter(
        id => quotes.find(q => q.id === id)?.type !== 'nettfront'
      )
      const nfIds = selectedQuotes.filter(
        id => quotes.find(q => q.id === id)?.type === 'nettfront'
      )

      const requests: Promise<Response>[] = []
      if (optiIds.length) {
        requests.push(
          fetch('/api/portal-quotes/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteIds: optiIds })
          })
        )
      }
      if (nfIds.length) {
        requests.push(
          fetch('/api/nettfront-quotes/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteIds: nfIds })
          })
        )
      }

      const responses = await Promise.all(requests)
      for (const response of responses) {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete quotes')
        }
      }

      toast.success(`${selectedQuotes.length} árajánlat sikeresen törölve`)
      setSelectedQuotes([])
      setDeleteDialogOpen(false)
      router.refresh()
    } catch (err) {
      console.error('[Customer Portal] Error deleting quotes:', err)
      toast.error('Hiba az árajánlatok törlése során')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRowClick = (quote: PortalQuote) => {
    if (quote.type === 'nettfront') {
      router.push(`/saved/nettfront/${quote.id}`)
    } else {
      router.push(`/saved/${quote.id}`)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
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

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          mb: 1,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Mentett ajánlataim
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Még el nem küldött lapszabászat és front ajánlatok.
          </Typography>
        </Box>

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

      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3, mt: 2, maxWidth: 520 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés ajánlatszám alapján..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {quotes.length === 0 ? (
        <Alert
          severity="info"
          action={
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button color="inherit" size="small" onClick={() => router.push('/opti')}>
                Lapszabászat
              </Button>
              <Button color="inherit" size="small" onClick={() => router.push('/nettfront')}>
                NETTFRONT
              </Button>
            </Box>
          }
        >
          {searchTerm
            ? 'Nincs találat a keresési feltételeknek megfelelően.'
            : 'Még nincs mentett ajánlatod. Kezdd a tervezést:'}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {mounted && (
                      <Checkbox
                        checked={selectedQuotes.length === quotes.length && quotes.length > 0}
                        indeterminate={
                          selectedQuotes.length > 0 && selectedQuotes.length < quotes.length
                        }
                        onChange={handleSelectAll}
                      />
                    )}
                  </TableCell>
                  <TableCell>Típus</TableCell>
                  <TableCell>Ajánlatszám</TableCell>
                  <TableCell align="center" sx={{ width: 56 }}>
                    Mj.
                  </TableCell>
                  <TableCell align="right">Végösszeg</TableCell>
                  <TableCell>Utolsó módosítás</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.map(quote => (
                  <TableRow
                    key={`${quote.type || 'opti'}-${quote.id}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(quote)}
                  >
                    <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                      {mounted && (
                        <Checkbox
                          checked={selectedQuotes.includes(quote.id)}
                          onChange={() => handleSelectQuote(quote.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <PortalTypeChip type={quote.type} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {quote.quote_number}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <QuoteCommentIcon comment={quote.comment} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {formatPortalCurrency(quote.final_total_after_discount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatPortalDateTime(quote.updated_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

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

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Összesen {totalCount} mentett ajánlat
          </Typography>
        </>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => !isDeleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Árajánlatok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretnéd a kijelölt {selectedQuotes.length} árajánlatot? Ez a művelet
            nem vonható vissza.
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

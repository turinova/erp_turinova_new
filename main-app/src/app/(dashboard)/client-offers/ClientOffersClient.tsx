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
  Button
} from '@mui/material'
import NextLink from 'next/link'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon } from '@mui/icons-material'
import { usePagePermission } from '@/hooks/usePagePermission'

interface ClientOffer {
  id: string
  offer_number: string
  customer_name: string
  total_gross: number
  status: string
  created_at: string
  created_by_email: string
  created_by_name: string
  worker_nickname: string
  worker_color: string
}

interface ClientOffersClientProps {
  initialOffers: ClientOffer[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize?: number
  statusCounts?: {
    all: number
    draft: number
    sent: number
    accepted: number
    rejected: number
  }
}

export default function ClientOffersClient({
  initialOffers,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize = 50,
  statusCounts = {
    all: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    rejected: 0
  }
}: ClientOffersClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionLoading } = usePagePermission('/client-offers')
  
  const [offers, setOffers] = useState<ClientOffer[]>(initialOffers)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || '')
  const [mounted, setMounted] = useState(false)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)

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
      if (statusFilter) {
        params.set('status', statusFilter)
      }
      router.push(`/client-offers?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, mounted, router])

  // Update offers when initialOffers prop changes (from server-side search)
  useEffect(() => {
    setOffers(initialOffers)
    setClientPage(currentPage)
  }, [initialOffers, currentPage])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    if (statusFilter) {
      params.set('status', statusFilter)
    }
    router.push(`/client-offers?${params.toString()}`)
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
    if (statusFilter) {
      params.set('status', statusFilter)
    }
    router.push(`/client-offers?${params.toString()}`)
  }

  // Handle row click (navigate to detail page)
  const handleRowClick = (offerId: string) => {
    router.push(`/client-offers/${offerId}`)
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date and time
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

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Vázlat', color: 'default' as const }
      case 'sent':
        return { label: 'Elküldve', color: 'info' as const }
      case 'accepted':
        return { label: 'Elfogadva', color: 'success' as const }
      case 'rejected':
        return { label: 'Elutasítva', color: 'error' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  if (permissionLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Betöltés...</Typography>
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
        <Typography color="text.primary">Értékesítés</Typography>
        <Typography color="text.primary">Ügyfél ajánlatok</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Ügyfél ajánlatok
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => router.push('/client-offers/new')}
        >
          Új ajánlat készítése
        </Button>
      </Box>

      {/* Status Filter Chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => {
            setStatusFilter('')
            const params = new URLSearchParams()
            params.set('page', '1')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/client-offers?${params.toString()}`)
          }}
          color={statusFilter === '' ? 'primary' : 'default'}
          variant={statusFilter === '' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Vázlat (${statusCounts.draft})`}
          onClick={() => {
            setStatusFilter('draft')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'draft')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/client-offers?${params.toString()}`)
          }}
          color={statusFilter === 'draft' ? 'default' : 'default'}
          variant={statusFilter === 'draft' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Elküldve (${statusCounts.sent})`}
          onClick={() => {
            setStatusFilter('sent')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'sent')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/client-offers?${params.toString()}`)
          }}
          color={statusFilter === 'sent' ? 'info' : 'default'}
          variant={statusFilter === 'sent' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Elfogadva (${statusCounts.accepted})`}
          onClick={() => {
            setStatusFilter('accepted')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'accepted')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/client-offers?${params.toString()}`)
          }}
          color={statusFilter === 'accepted' ? 'success' : 'default'}
          variant={statusFilter === 'accepted' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Elutasítva (${statusCounts.rejected})`}
          onClick={() => {
            setStatusFilter('rejected')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'rejected')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/client-offers?${params.toString()}`)
          }}
          color={statusFilter === 'rejected' ? 'error' : 'default'}
          variant={statusFilter === 'rejected' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés ügyfél neve szerint..."
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
                <TableCell>Ajánlat szám</TableCell>
                <TableCell>Ügyfél</TableCell>
                <TableCell align="right">Bruttó összesen</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Dátum</TableCell>
                <TableCell>Létrehozta</TableCell>
                <TableCell>Dolgozó</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {offers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Nincs megjeleníthető ajánlat.
                  </TableCell>
                </TableRow>
              ) : offers.map(offer => {
                const statusInfo = getStatusInfo(offer.status)
                return (
                  <TableRow
                    key={offer.id}
                    hover
                    onClick={() => handleRowClick(offer.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell><strong>{offer.offer_number}</strong></TableCell>
                    <TableCell>{offer.customer_name}</TableCell>
                    <TableCell align="right">{formatCurrency(offer.total_gross)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={statusInfo.label} 
                        size="small"
                        color={statusInfo.color}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(offer.created_at)}</TableCell>
                    <TableCell>
                      {offer.created_by_name || offer.created_by_email || '-'}
                    </TableCell>
                    <TableCell>
                      {offer.worker_nickname ? (
                        <Chip 
                          label={offer.worker_nickname} 
                          size="small"
                          sx={{
                            backgroundColor: offer.worker_color ? `${offer.worker_color}20` : undefined,
                            color: offer.worker_color || undefined,
                            borderColor: offer.worker_color || undefined,
                            borderWidth: offer.worker_color ? '1px' : undefined,
                            borderStyle: offer.worker_color ? 'solid' : undefined
                          }}
                        />
                      ) : (
                        '-'
                      )}
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
          {searchTerm || statusFilter
            ? `Keresési eredmény: ${totalCount} ajánlat` 
            : `Összesen ${totalCount} ajánlat`
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
    </Box>
  )
}


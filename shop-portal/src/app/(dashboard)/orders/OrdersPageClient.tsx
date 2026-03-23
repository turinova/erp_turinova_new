'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Pagination,
  Paper
} from '@mui/material'
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'
import OrdersTable from './OrdersTable'
import type { OrderRow } from './OrdersTableBody'
import { ORDER_STATUS_LABELS } from '@/lib/order-status'

function buildOrdersListHref(opts: { page: number; limit: number; status: string; search: string }) {
  const p = new URLSearchParams()
  const q = opts.search.trim()
  if (q) p.set('search', q)
  if (opts.status && opts.status !== 'all') p.set('status', opts.status)
  p.set('limit', String(opts.limit))
  if (opts.page > 1) p.set('page', String(opts.page))
  return `/orders?${p.toString()}`
}

const LIMIT_OPTIONS = [20, 50, 100] as const

export type OrdersPageClientProps = {
  orders: OrderRow[]
  batchByOrderId: Record<string, { id: string; code: string }>
  totalCount: number
  totalPages: number
  currentPage: number
  limit: number
  initialStatus: string
  initialSearch: string
}

export default function OrdersPageClient({
  orders,
  batchByOrderId,
  totalCount,
  totalPages,
  currentPage,
  limit,
  initialStatus,
  initialSearch
}: OrdersPageClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all')
  const [limitFilter, setLimitFilter] = useState(limit)
  const debouncedSearch = useDebounce(searchTerm, 600)

  const filterBaselineRef = useRef<{ s: string; st: string; l: number } | null>(null)

  // Keep local state in sync when URL changes (back/forward, clear filters)
  useEffect(() => {
    setSearchTerm(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(initialStatus || 'all')
  }, [initialStatus])

  useEffect(() => {
    setLimitFilter(limit)
  }, [limit])

  // After filter/search/limit changes → go to page 1 (skip first run)
  useEffect(() => {
    const key = { s: debouncedSearch, st: statusFilter, l: limitFilter }
    if (filterBaselineRef.current === null) {
      filterBaselineRef.current = key
      return
    }
    const prev = filterBaselineRef.current
    if (prev.s === key.s && prev.st === key.st && prev.l === key.l) return
    filterBaselineRef.current = key
    router.push(
      buildOrdersListHref({
        page: 1,
        limit: key.l,
        status: key.st,
        search: key.s
      })
    )
  }, [debouncedSearch, statusFilter, limitFilter, router])

  const handlePageChange = useCallback(
    (_: React.ChangeEvent<unknown>, page: number) => {
      router.push(
        buildOrdersListHref({
          page,
          limit: limitFilter,
          status: statusFilter,
          search: debouncedSearch
        })
      )
    },
    [router, limitFilter, statusFilter, debouncedSearch]
  )

  /** Use immediate search text so „Szűrők törlése” / empty state update right away (debounce only affects URL). */
  const hasActiveFilters =
    (statusFilter && statusFilter !== 'all') || !!searchTerm.trim() || limitFilter !== 20

  const handleClearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setLimitFilter(20)
    filterBaselineRef.current = { s: '', st: 'all', l: 20 }
    router.push(buildOrdersListHref({ page: 1, limit: 20, status: 'all', search: '' }))
  }

  const statusEntries = Object.entries(ORDER_STATUS_LABELS)

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Rendelések
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.65 }}>
            Webshop és egyéb források rendeléseinek áttekintése, szűrése és tömeges műveletei (begyűjtés, megszüntetés). A
            részletekhez kattintson a sorra.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <Button
            component={NextLink}
            href="/orders/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Új rendelés
          </Button>
          <Button component={NextLink} href="/orders/buffer" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Rendelés puffer →
          </Button>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'grey.50'
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 600, letterSpacing: '0.06em' }}>
          SZŰRŐK
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Státusz</InputLabel>
            <Select
              value={statusFilter}
              label="Státusz"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Összes</MenuItem>
              {statusEntries.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Oldalméret</InputLabel>
            <Select
              value={limitFilter}
              label="Oldalméret"
              onChange={(e) => setLimitFilter(Number(e.target.value))}
            >
              {LIMIT_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n} / oldal
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            placeholder="Keresés: rendelésszám, név, e-mail…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 280, flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          {hasActiveFilters && (
            <Button size="small" onClick={handleClearFilters} sx={{ alignSelf: 'center', textTransform: 'none' }}>
              Szűrők törlése
            </Button>
          )}
        </Box>
      </Paper>

      <OrdersTable
        orders={orders}
        batchByOrderId={batchByOrderId}
        hasActiveFilters={hasActiveFilters}
      />

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
          <Typography variant="body2" color="text.secondary">
            {totalCount} rendelés összesen
          </Typography>
        </Box>
      )}

      {totalPages <= 1 && totalCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {totalCount} rendelés
        </Typography>
      )}
    </Box>
  )
}

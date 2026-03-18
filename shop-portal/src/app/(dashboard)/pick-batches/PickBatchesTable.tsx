'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
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
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Pagination,
  TextField,
  InputAdornment
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon, Clear as ClearIcon, Inventory as InventoryIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface PickBatch {
  id: string
  code: string
  name: string | null
  status: string
  created_by_user: { id: string; email: string; full_name: string | null } | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  order_count: number
  item_count: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Piszkozat', color: '#ffffff', bgColor: '#78909c' },
  in_progress: { label: 'Folyamatban', color: '#ffffff', bgColor: '#1565c0' },
  completed: { label: 'Kész', color: '#ffffff', bgColor: '#2e7d32' },
  cancelled: { label: 'Megszakítva', color: '#ffffff', bgColor: '#c62828' }
}

const STATUS_ROW_COLORS: Record<string, string> = {
  draft: '#ECEFF1',
  in_progress: '#E3F2FD',
  completed: '#E8F5E9',
  cancelled: '#FFEBEE'
}

function PickBatchStatusChip({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: '#ffffff', bgColor: '#757575' }
  return (
    <Chip
      label={config.label}
      size="small"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24
      }}
    />
  )
}

function creatorDisplay(created_by_user: PickBatch['created_by_user']): string {
  if (!created_by_user) return '–'
  if (created_by_user.full_name?.trim()) return created_by_user.full_name.trim()
  return created_by_user.email || '–'
}

export default function PickBatchesTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [batches, setBatches] = useState<PickBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'active')
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const debouncedSearch = useDebounce(searchTerm, 500)
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [creating, setCreating] = useState(false)

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/pick-batches?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setBatches(data.pick_batches || [])
      setTotalPages(data.pagination?.totalPages ?? 1)
      setTotal(data.pagination?.total ?? 0)
    } catch (e) {
      console.error(e)
      toast.error('Hiba a begyűjtések lekérdezésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [statusFilter, debouncedSearch, page])

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    else params.delete('status')
    if (debouncedSearch) params.set('search', debouncedSearch)
    else params.delete('search')
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    const q = params.toString()
    router.replace(q ? `/pick-batches?${q}` : '/pick-batches', { scroll: false })
  }, [statusFilter, debouncedSearch, page, router])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/pick-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Hiba')
      }
      const data = await res.json()
      toast.success('Begyűjtés létrehozva')
      router.push(`/pick-batches/${data.pick_batch.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Hiba a létrehozáskor')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '–'
    return new Date(date).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const hasActiveFilters = (statusFilter && statusFilter !== 'all') || !!debouncedSearch
  const handleClearFilters = () => {
    setStatusFilter('active')
    setSearchTerm('')
    setPage(1)
    router.replace('/pick-batches?status=active', { scroll: false })
  }

  const activeCount = batches.filter(b => b.status === 'draft' || b.status === 'in_progress').length

  return (
    <Box>
      {/* Header – clear title and what to do */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Begyűjtések
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt csoportosítod a rendeléseket begyűjtésbe: hozz létre egy begyűjtést, add hozzá a rendeléseket, indítsd el, majd a raktárban szedd össze a tételeket. Végül zárd le a begyűjtést.
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            value={statusFilter}
            label="Státusz"
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="all">Összes</MenuItem>
            <MenuItem value="active">Aktív (piszkozat vagy folyamatban)</MenuItem>
            <MenuItem value="draft">Piszkozat</MenuItem>
            <MenuItem value="in_progress">Folyamatban</MenuItem>
            <MenuItem value="completed">Kész</MenuItem>
            <MenuItem value="cancelled">Megszakítva</MenuItem>
          </Select>
        </FormControl>
        <TextField
          placeholder="Keresés: kód, létrehozó neve vagy e-mailje…"
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
          <Button size="small" onClick={handleClearFilters} startIcon={<ClearIcon />}>
            Szűrők törlése
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} disabled={creating}>
          {creating ? 'Létrehozás…' : 'Új begyűjtés'}
        </Button>
      </Box>

      {/* Summary – so user sees counts at a glance */}
      {!loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Összesen <strong>{total}</strong> begyűjtés
          {statusFilter === 'all' && total > 0 && activeCount > 0 && (
            <> · Ebből <strong>{activeCount}</strong> aktív (piszkozat vagy folyamatban)</>
          )}
        </Typography>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Rendelések</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, textAlign: 'right' }}>Tételek</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Létrehozta</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Létrehozva</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Befejezve</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, width: 100 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {hasActiveFilters
                        ? 'Nincs találat a szűrőknek megfelelően. Próbáld a szűrők törlését.'
                        : 'Még nincs begyűjtés. Hozz létre egyet, majd add hozzá a rendeléseket – utána indítsd el a begyűjtést.'}
                    </Typography>
                    {!hasActiveFilters && (
                      <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} disabled={creating}>
                        Új begyűjtés
                      </Button>
                    )}
                    {hasActiveFilters && (
                      <Button variant="outlined" size="small" onClick={handleClearFilters}>
                        Szűrők törlése
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow
                  key={b.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '& td': { py: 1 },
                    backgroundColor: STATUS_ROW_COLORS[b.status] || '#FAFAFA',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                  onClick={() => router.push(`/pick-batches/${b.id}`)}
                >
                  <TableCell>
                    <Box
                      component={NextLink}
                      href={`/pick-batches/${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none' }}
                    >
                      {b.code}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <PickBatchStatusChip status={b.status} />
                  </TableCell>
                  <TableCell align="right">{b.order_count}</TableCell>
                  <TableCell align="right">{b.item_count}</TableCell>
                  <TableCell>{creatorDisplay(b.created_by_user)}</TableCell>
                  <TableCell>{formatDate(b.created_at)}</TableCell>
                  <TableCell>{formatDate(b.completed_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button size="small" component={NextLink} href={`/pick-batches/${b.id}`} variant="outlined">
                      Megnyitás
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  )
}

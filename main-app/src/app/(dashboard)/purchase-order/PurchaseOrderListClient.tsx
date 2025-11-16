'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Button, Breadcrumbs, Chip, CircularProgress, FormControl, InputLabel, Link, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, Checkbox, InputAdornment, Tooltip
} from '@mui/material'
import NextLink from 'next/link'
import { Home as HomeIcon, Add as AddIcon, Check as ApproveIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface PurchaseOrderRow {
  id: string
  po_number: string
  status: string
  partner_name: string
  items_count: number
  net_total: number | null
  created_at: string
  expected_date: string | null
  shipments_count: number
}

export default function PurchaseOrderListClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PurchaseOrderRow[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [partnerSearch, setPartnerSearch] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const statusCounts = useMemo(() => {
    return {
      all: rows.length,
      draft: rows.filter(r => r.status === 'draft').length,
      sent: rows.filter(r => r.status === 'sent').length,
      confirmed: rows.filter(r => r.status === 'confirmed').length,
      received: rows.filter(r => r.status === 'received').length,
      cancelled: rows.filter(r => r.status === 'cancelled').length
    }
  }, [rows])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (partnerSearch.trim()) params.set('search', partnerSearch.trim())
      const res = await fetch(`/api/purchase-order?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a PO-k lekérdezésekor')
      setRows(data.purchase_orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a PO-k betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [statusFilter])
  useEffect(() => {
    const h = setTimeout(() => { fetchRows() }, 400)
    return () => clearTimeout(h)
  }, [partnerSearch])

  const handleApprove = async () => {
    if (selectedIds.size === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/purchase-order/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), new_status: 'sent' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a jóváhagyáskor')
      toast.success(`Jóváhagyva: ${data.updated_count}`)
      setSelectedIds(new Set())
      fetchRows()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a jóváhagyás során')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/purchase-order/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Hiba a törléskor')
      toast.success(`Törölve: ${data.deleted_count}`)
      setSelectedIds(new Set())
      fetchRows()
    } catch (e) {
      console.error(e)
      toast.error('Hiba a törlés során')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Beszerzés</Typography>
        <Typography color="text.primary">Beszállítói rendelése</Typography>
      </Breadcrumbs>

      {/* Status chips row (like Orders) */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => setStatusFilter('all')}
          color={statusFilter === 'all' ? 'primary' : 'default'}
          variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Vázlat (${statusCounts.draft})`}
          onClick={() => setStatusFilter('draft')}
          color={statusFilter === 'draft' ? 'warning' : 'default'}
          variant={statusFilter === 'draft' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Elküldve (${statusCounts.sent})`}
          onClick={() => setStatusFilter('sent')}
          color={statusFilter === 'sent' ? 'info' : 'default'}
          variant={statusFilter === 'sent' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Visszaigazolt (${statusCounts.confirmed})`}
          onClick={() => setStatusFilter('confirmed')}
          color={statusFilter === 'confirmed' ? 'success' : 'default'}
          variant={statusFilter === 'confirmed' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Beérkezett (${statusCounts.received})`}
          onClick={() => setStatusFilter('received')}
          color={statusFilter === 'received' ? 'primary' : 'default'}
          variant={statusFilter === 'received' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.cancelled})`}
          onClick={() => setStatusFilter('cancelled')}
          color={statusFilter === 'cancelled' ? 'error' : 'default'}
          variant={statusFilter === 'cancelled' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search and actions */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés beszállító neve szerint..."
          value={partnerSearch}
          onChange={(e) => setPartnerSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/purchase-order/new')}
        >
          Új beszállítói rendelés
        </Button>
      </Stack>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedIds.size} kijelölve):
          </Typography>
          <Button
            variant="contained"
            color="success"
            startIcon={<ApproveIcon />}
            onClick={handleApprove}
            disabled={busy}
            size="small"
          >
            Jóváhagyás
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={busy}
            size="small"
          >
            Törlés
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === rows.length && rows.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < rows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(rows.map(r => r.id)))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                  />
                </TableCell>
                <TableCell>PO szám</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell align="right">Tételek száma</TableCell>
                <TableCell align="right">Nettó összesen</TableCell>
                <TableCell>Létrehozva</TableCell>
                <TableCell>Várható időpont</TableCell>
                <TableCell align="right">Szállítmányok száma</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Nincs megjeleníthető beszerzési rendelés.
                  </TableCell>
                </TableRow>
              ) : rows.map(row => {
                const isSelected = selectedIds.has(row.id)
                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={isSelected}
                    onClick={() => router.push(`/purchase-order/${row.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds(prev => {
                            const copy = new Set(prev)
                            if (copy.has(row.id)) copy.delete(row.id)
                            else copy.add(row.id)
                            return copy
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.po_number}</TableCell>
                    <TableCell>
                      <Chip label={row.status} size="small" />
                    </TableCell>
                    <TableCell>{row.partner_name}</TableCell>
                    <TableCell align="right">{row.items_count}</TableCell>
                    <TableCell align="right">{row.net_total ? new Intl.NumberFormat('hu-HU').format(row.net_total) + ' Ft' : '-'}</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('hu-HU') : ''}</TableCell>
                    <TableCell>{row.expected_date ? new Date(row.expected_date).toLocaleDateString('hu-HU') : '-'}</TableCell>
                    <TableCell align="right">{row.shipments_count}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}



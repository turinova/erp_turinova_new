'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Button, Checkbox, CircularProgress, Link, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography
} from '@mui/material'
import { Home as HomeIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { usePagePermission } from '@/hooks/usePagePermission'
import NextLink from 'next/link'

type SuggestionRow = {
  id: string
  created_at: string
  raw_product_name: string
  raw_sku: string | null
  raw_base_price: number | null
  raw_multiplier: number | null
  raw_units_id: string | null
  raw_partner_id: string | null
  raw_vat_id: string | null
  raw_currency_id: string | null
  unit_name: string | null
  unit_shortform: string | null
  partner_name: string | null
  vat_percent: number | null
}

export default function ProductSuggestionsClient() {
  const router = useRouter()
  const { hasAccess, loading } = usePagePermission('/product-suggestions')

  const [isLoading, setIsLoading] = useState(true)
  const [rows, setRows] = useState<SuggestionRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast.error('Nincs jogosultsága a Termék javaslatok oldal megtekintéséhez!', {
        position: 'top-right'
      })
      router.push('/home')
    }
  }, [hasAccess, loading, router])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/product-suggestions')
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || 'Sikertelen lekérés')
        }
        const data = await res.json()
        setRows(data?.suggestions || [])
      } catch (e) {
        console.error(e)
        toast.error('Hiba történt a termék javaslatok lekérésekor')
      } finally {
        setIsLoading(false)
      }
    }
    if (hasAccess) fetchData()
  }, [hasAccess])

  const isAllSelected = useMemo(() => rows.length > 0 && selected.size === rows.length, [rows, selected])
  const isIndeterminate = useMemo(() => selected.size > 0 && selected.size < rows.length, [rows, selected])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(rows.map(r => r.id)))
    } else {
      setSelected(new Set())
    }
  }

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatCurrency = (value: number | null | undefined) =>
    new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0, maximumFractionDigits: 0 })
      .format(Math.round(value || 0))

  const computeNet = (row: SuggestionRow) => {
    if (row.raw_base_price == null || row.raw_multiplier == null) return 0
    return Math.round(row.raw_base_price * row.raw_multiplier)
  }
  const computeGross = (row: SuggestionRow) => {
    const net = computeNet(row)
    const vat = row.vat_percent || 0
    return Math.round(net * (1 + vat / 100))
  }

  const handleBulkReject = async () => {
    if (selected.size === 0) return
    try {
      const res = await fetch('/api/product-suggestions/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Elutasítás sikertelen')
      toast.success(`Elutasítva: ${data.updated}`)
      // remove from list
      setRows(prev => prev.filter(r => !selected.has(r.id)))
      setSelected(new Set())
    } catch (e) {
      console.error(e)
      toast.error('Hiba történt az elutasítás során')
    }
  }

  const handleBulkApprove = async () => {
    if (selected.size === 0) return
    try {
      const res = await fetch('/api/product-suggestions/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Mentés sikertelen')
      toast.success(`Létrehozott termékek: ${data.created}, jóváhagyva: ${data.updated}`)
      // remove approved from list
      setRows(prev => prev.filter(r => !selected.has(r.id)))
      setSelected(new Set())
    } catch (e) {
      console.error(e)
      toast.error('Hiba történt a mentés során')
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!hasAccess) return null

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
        <Typography color="text.primary">Termék javaslatok</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Termék javaslatok</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={handleBulkReject}
            disabled={selected.size === 0}
          >
            Törlés ({selected.size})
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            color="primary"
            onClick={handleBulkApprove}
            disabled={selected.size === 0}
          >
            Mentés ({selected.size})
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Termék neve</TableCell>
                <TableCell>Mértékegység</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell align="right">Beszerzési ár</TableCell>
                <TableCell align="right">Árrés szorzó</TableCell>
                <TableCell align="right">Nettó ár</TableCell>
                <TableCell align="right">Bruttó ár</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow
                  key={row.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/product-suggestions/${row.id}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onChange={() => handleToggle(row.id)}
                    />
                  </TableCell>
                  <TableCell>{row.raw_sku || ''}</TableCell>
                  <TableCell>{row.raw_product_name}</TableCell>
                  <TableCell>{row.unit_shortform || row.unit_name || ''}</TableCell>
                  <TableCell>{row.partner_name || ''}</TableCell>
                  <TableCell align="right">{formatCurrency(row.raw_base_price)}</TableCell>
                  <TableCell align="right">{row.raw_multiplier ?? ''}</TableCell>
                  <TableCell align="right">{formatCurrency(computeNet(row))}</TableCell>
                  <TableCell align="right">{formatCurrency(computeGross(row))}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography color="text.secondary">Nincs megjeleníthető javaslat.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}



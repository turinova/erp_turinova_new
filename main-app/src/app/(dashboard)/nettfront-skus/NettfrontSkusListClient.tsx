'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import {
  finishLabel,
  frontTypeLabel,
  NETTFRONT_FINISHES,
  NETTFRONT_FRONT_TYPES,
  sellGrossFromNet
} from '@/lib/nettfront-sku-constants'

export type NettfrontSkuListItem = {
  id: string
  front_type: string
  sku_code: string
  display_name: string
  finish: string | null
  swatch_hex: string | null
  cost_net_per_sqm: number
  sell_net_per_sqm: number
  is_active: boolean
  sort_order: number
}

function formatFt(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0
  }).format(n)
}

export default function NettfrontSkusListClient({
  initialSkus
}: {
  initialSkus: NettfrontSkuListItem[]
}) {
  const router = useRouter()
  const [skus, setSkus] = useState(initialSkus)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterFinish, setFilterFinish] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
  const [mounted, setMounted] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setSkus(initialSkus)
  }, [initialSkus])

  const filtered = useMemo(() => {
    let list = skus
    if (filterType !== 'all') list = list.filter(s => s.front_type === filterType)
    if (filterFinish !== 'all') {
      list = list.filter(s => (s.finish || '') === filterFinish)
    }
    if (filterActive === 'active') list = list.filter(s => s.is_active)
    if (filterActive === 'inactive') list = list.filter(s => !s.is_active)

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(
        s =>
          s.display_name.toLowerCase().includes(term) ||
          s.sku_code.toLowerCase().includes(term)
      )
    }
    return list
  }, [skus, searchTerm, filterType, filterFinish, filterActive])

  const isAllSelected =
    filtered.length > 0 && filtered.every(s => selectedIds.includes(s.id))
  const isIndeterminate =
    selectedIds.length > 0 && !isAllSelected && filtered.some(s => selectedIds.includes(s.id))

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => {
        const set = new Set(prev)
        filtered.forEach(s => set.add(s.id))
        return Array.from(set)
      })
    } else {
      const filteredIds = new Set(filtered.map(s => s.id))
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)))
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleDeleteConfirm = async () => {
    if (selectedIds.length === 0) return
    setIsDeleting(true)
    try {
      const results = await Promise.allSettled(
        selectedIds.map(id =>
          fetch(`/api/nettfront-skus/${id}`, { method: 'DELETE' })
        )
      )
      const failed = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      )
      if (failed.length === 0) {
        toast.success(`${selectedIds.length} anyag törölve`)
        setSkus(prev => prev.filter(s => !selectedIds.includes(s.id)))
        setSelectedIds([])
        router.refresh()
      } else {
        toast.error(`${failed.length} törlés sikertelen`)
      }
    } catch {
      toast.error('Hiba a törlés során')
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Nettfront anyagok</Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Typography variant="h4">Nettfront anyagok</Typography>
        {mounted && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={selectedIds.length === 0}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Törlés ({selectedIds.length})
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/nettfront-skus/new')}
            >
              Új anyag
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Keresés név / SKU…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Típus</InputLabel>
          <Select
            label="Típus"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <MenuItem value="all">Mind</MenuItem>
            {NETTFRONT_FRONT_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Finish</InputLabel>
          <Select
            label="Finish"
            value={filterFinish}
            onChange={e => setFilterFinish(e.target.value)}
          >
            <MenuItem value="all">Mind</MenuItem>
            {NETTFRONT_FINISHES.map(f => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Státusz</InputLabel>
          <Select
            label="Státusz"
            value={filterActive}
            onChange={e => setFilterActive(e.target.value)}
          >
            <MenuItem value="all">Mind</MenuItem>
            <MenuItem value="active">Aktív</MenuItem>
            <MenuItem value="inactive">Inaktív</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={e => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell width={48} />
              <TableCell>Név</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Típus</TableCell>
              <TableCell>Finish</TableCell>
              <TableCell align="right">Bekerülés nettó</TableCell>
              <TableCell align="right">Eladás nettó</TableCell>
              <TableCell align="right">Eladás bruttó</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell align="right">Sorrend</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  Nincs találat
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(sku => (
                <TableRow
                  key={sku.id}
                  hover
                  selected={selectedIds.includes(sku.id)}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/nettfront-skus/${sku.id}/edit`)}
                >
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(sku.id)}
                      onChange={() => handleSelectOne(sku.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: sku.swatch_hex || '#eee'
                      }}
                    />
                  </TableCell>
                  <TableCell>{sku.display_name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {sku.sku_code}
                    </Typography>
                  </TableCell>
                  <TableCell>{frontTypeLabel(sku.front_type)}</TableCell>
                  <TableCell>{finishLabel(sku.finish)}</TableCell>
                  <TableCell align="right">{formatFt(sku.cost_net_per_sqm)}</TableCell>
                  <TableCell align="right">{formatFt(sku.sell_net_per_sqm)}</TableCell>
                  <TableCell align="right">
                    {formatFt(sellGrossFromNet(sku.sell_net_per_sqm))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={sku.is_active ? 'Aktív' : 'Inaktív'}
                      color={sku.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">{sku.sort_order}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {filtered.length} / {skus.length} anyag
      </Typography>

      <Dialog open={deleteDialogOpen} onClose={() => !isDeleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Anyagok törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretnéd a kiválasztott {selectedIds.length} anyagot? A törlés
            soft delete (visszaállítható az adatbázisból). A Fronttervező katalógusból
            eltűnnek.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            Mégse
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

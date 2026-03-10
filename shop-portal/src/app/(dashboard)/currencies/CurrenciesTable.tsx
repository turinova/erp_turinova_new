'use client'

import React, { useState } from 'react'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Checkbox,
  Chip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  CurrencyExchange as CurrencyExchangeIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Currency {
  id: string
  name: string
  code: string
  symbol: string | null
  rate: number
  is_base: boolean
  created_at: string
  updated_at: string
}

interface CurrenciesTableProps {
  initialCurrencies: Currency[]
}

export default function CurrenciesTable({ initialCurrencies }: CurrenciesTableProps) {
  const [currencies, setCurrencies] = useState<Currency[]>(initialCurrencies)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null)
  const [deletingCurrency, setDeletingCurrency] = useState<Currency | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', symbol: '', rate: '1.0000', is_base: false })
  const [errors, setErrors] = useState<{ name?: string; code?: string; rate?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (currency?: Currency) => {
    if (currency) {
      setEditingCurrency(currency)
      setFormData({
        name: currency.name,
        code: currency.code,
        symbol: currency.symbol || '',
        rate: currency.rate.toString(),
        is_base: currency.is_base
      })
    } else {
      setEditingCurrency(null)
      setFormData({ name: '', code: '', symbol: '', rate: '1.0000', is_base: false })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingCurrency(null)
    setFormData({ name: '', code: '', symbol: '', rate: '1.0000', is_base: false })
    setErrors({})
  }

  const handleOpenDeleteDialog = (currency: Currency) => {
    setDeletingCurrency(currency)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingCurrency(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(currencies.map(c => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (currencyId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(currencyId)) {
      newSelected.delete(currencyId)
    } else {
      newSelected.add(currencyId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (currency: Currency) => {
    handleOpenDialog(currency)
  }

  const isAllSelected = currencies.length > 0 && selectedIds.size === currencies.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < currencies.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedCurrencies = currencies.filter(c => selectedIds.has(c.id))
    if (selectedCurrencies.length === 1) {
      setDeletingCurrency(selectedCurrencies[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingCurrency(selectedCurrencies[0])
      setDeleteDialogOpen(true)
    }
  }

  // Bulk edit - edit first selected
  const handleBulkEdit = () => {
    if (selectedIds.size === 0) return
    const selectedCurrencies = currencies.filter(c => selectedIds.has(c.id))
    if (selectedCurrencies.length > 0) {
      handleOpenDialog(selectedCurrencies[0])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; code?: string; rate?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A pénznem neve kötelező'
    }

    if (!formData.code.trim()) {
      newErrors.code = 'A pénznem kódja kötelező'
    } else if (formData.code.trim().length !== 3) {
      newErrors.code = 'A pénznem kódja pontosan 3 karakter kell legyen (ISO kód)'
    }

    const rateNum = parseFloat(formData.rate)
    if (isNaN(rateNum) || rateNum < 0) {
      newErrors.rate = 'Az árfolyam érvényes pozitív szám kell legyen'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      const url = editingCurrency
        ? `/api/currencies/${editingCurrency.id}`
        : '/api/currencies'
      const method = editingCurrency ? 'PUT' : 'POST'

      // If setting as base, unset other bases
      if (formData.is_base && !editingCurrency) {
        // This will be handled in the API
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          symbol: formData.symbol.trim() || null,
          rate: parseFloat(formData.rate),
          is_base: formData.is_base
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedCurrency = result.currency

      if (editingCurrency) {
        setCurrencies(prev =>
          prev.map(currency => (currency.id === editingCurrency.id ? updatedCurrency : currency))
        )
        toast.success('Pénznem sikeresen frissítve')
      } else {
        setCurrencies(prev => {
          const newList = [...prev, updatedCurrency]
          // Sort: base first, then by name
          return newList.sort((a, b) => {
            if (a.is_base && !b.is_base) return -1
            if (!a.is_base && b.is_base) return 1
            return a.name.localeCompare(b.name)
          })
        })
        toast.success('Pénznem sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving currency:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCurrency) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/currencies/${deletingCurrency.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setCurrencies(prev => prev.filter(currency => currency.id !== deletingCurrency.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingCurrency.id)
        return newSet
      })
      toast.success('Pénznem sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting currency:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Pénznemek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a pénznemeket, amelyeket a beszállítóknál használhat. A pénznemek globálisan elérhetők minden beszállítónál.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a pénznemekről:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A pénznemek <strong>globálisan</strong> elérhetők - egyszer hozza létre, minden beszállítónál használhatja</li>
            <li>A pénznemeket a beszállítók fizetési beállításainál választhatja ki</li>
            <li>Az <strong>árfolyam</strong> a bázis pénznemhez viszonyított érték</li>
            <li>Csak <strong>egy bázis pénznem</strong> lehet aktív egyszerre</li>
          </ul>
        </Typography>
      </Alert>

      {/* Action Buttons - Above Table */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap', alignItems: 'center' }}>
        {selectedIds.size > 0 && (
          <>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleBulkEdit}
              disabled={selectedIds.size === 0}
              sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              Szerkesztés ({selectedIds.size})
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              Törlés ({selectedIds.size})
            </Button>
          </>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új pénznem
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                  disabled={currencies.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Szimbólum</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Árfolyam</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Bázis</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CurrencyExchangeIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs pénznem létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első pénznemet
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              currencies.map((currency) => (
                <TableRow 
                  key={currency.id} 
                  hover
                  selected={selectedIds.has(currency.id)}
                  onClick={() => handleRowClick(currency)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(currency.id)}
                      onChange={(e) => handleSelectOne(currency.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {currency.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={currency.code}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {currency.symbol || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {currency.rate.toFixed(4)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {currency.is_base && (
                      <Chip 
                        label="Bázis" 
                        size="small" 
                        sx={{
                          bgcolor: '#4caf50',
                          color: 'white',
                          fontWeight: 500
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCurrency ? 'Pénznem szerkesztése' : 'Új pénznem létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="Pénznem neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "Forint", "Euró", "Amerikai dollár"'}
              placeholder="Forint"
            />
            <TextField
              label="ISO kód"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              fullWidth
              required
              error={!!errors.code}
              helperText={errors.code || '3 karakteres ISO kód (pl. HUF, EUR, USD)'}
              placeholder="HUF"
              inputProps={{ maxLength: 3 }}
            />
            <TextField
              label="Szimbólum"
              value={formData.symbol}
              onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
              fullWidth
              helperText="Példa: Ft, €, $, £"
              placeholder="Ft"
            />
            <TextField
              label="Árfolyam"
              type="number"
              value={formData.rate}
              onChange={(e) => setFormData(prev => ({ ...prev, rate: e.target.value }))}
              fullWidth
              required
              error={!!errors.rate}
              helperText={errors.rate || 'Árfolyam a bázis pénznemhez viszonyítva'}
              inputProps={{ step: '0.0001', min: '0' }}
            />
            <Alert severity="info">
              <Typography variant="body2">
                Ha bázis pénznemként jelöli meg, az összes többi pénznem árfolyama ehhez képest lesz számítva.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingCurrency ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingCurrency?.name}" ({deletingCurrency?.code})</strong> pénznemet?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak beszállítók, amelyek ezt a pénznemet használják, azok továbbra is
              működni fognak, de a pénznem törlés után nem lesz elérhető új beszállítókhoz.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
            Mégse
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

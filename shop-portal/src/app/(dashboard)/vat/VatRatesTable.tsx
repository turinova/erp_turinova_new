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
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

interface VatRatesTableProps {
  initialVatRates: VatRate[]
}

export default function VatRatesTable({ initialVatRates }: VatRatesTableProps) {
  const [vatRates, setVatRates] = useState<VatRate[]>(initialVatRates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingVat, setEditingVat] = useState<VatRate | null>(null)
  const [deletingVat, setDeletingVat] = useState<VatRate | null>(null)
  const [formData, setFormData] = useState({ name: '', kulcs: '' })
  const [errors, setErrors] = useState<{ name?: string; kulcs?: string }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (vat?: VatRate) => {
    if (vat) {
      setEditingVat(vat)
      setFormData({ name: vat.name, kulcs: vat.kulcs.toString() })
    } else {
      setEditingVat(null)
      setFormData({ name: '', kulcs: '' })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingVat(null)
    setFormData({ name: '', kulcs: '' })
    setErrors({})
  }

  const handleOpenDeleteDialog = (vat: VatRate) => {
    setDeletingVat(vat)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingVat(null)
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; kulcs?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Az ÁFA kulcs neve kötelező'
    }

    if (!formData.kulcs || formData.kulcs.trim() === '') {
      newErrors.kulcs = 'Az ÁFA kulcs értéke kötelező'
    } else {
      const kulcsValue = parseFloat(formData.kulcs)
      if (isNaN(kulcsValue)) {
        newErrors.kulcs = 'Az ÁFA kulcs számnak kell lennie'
      } else if (kulcsValue < 0 || kulcsValue > 100) {
        newErrors.kulcs = 'Az ÁFA kulcs 0 és 100% közé kell essen'
      }
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
      const url = editingVat
        ? `/api/vat-rates/${editingVat.id}`
        : '/api/vat-rates'
      const method = editingVat ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          kulcs: parseFloat(formData.kulcs)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedVat = result.vatRate

      if (editingVat) {
        setVatRates(prev =>
          prev.map(vat => (vat.id === editingVat.id ? updatedVat : vat))
        )
        toast.success('ÁFA kulcs sikeresen frissítve')
      } else {
        setVatRates(prev => [...prev, updatedVat].sort((a, b) => a.kulcs - b.kulcs))
        toast.success('ÁFA kulcs sikeresen létrehozva')
      }

      handleCloseDialog()
    } catch (error) {
      console.error('Error saving VAT rate:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingVat) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/vat-rates/${deletingVat.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setVatRates(prev => prev.filter(vat => vat.id !== deletingVat.id))
      toast.success('ÁFA kulcs sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting VAT rate:', error)
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            ÁFA kulcsok kezelése
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Itt kezelheti az ÁFA (Általános Forgalmi Adó) kulcsokat, amelyeket a termékek árazásánál használhat.
            Az ÁFA kulcsok határozzák meg, hogy a termékek bruttó árában mekkora adó összeget kell tartalmazniuk.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ minWidth: 150 }}
        >
          Új ÁFA kulcs
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 3 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk az ÁFA kulcsokról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Az ÁFA kulcs határozza meg, hogy a termék bruttó árában mekkora adó összeget kell tartalmazniuk</li>
            <li>A <strong>nettó ár</strong> az ár ÁFA nélkül (amit Ön kap)</li>
            <li>A <strong>bruttó ár</strong> az ár ÁFÁ-val együtt (amit a vásárló fizet)</li>
            <li>Példa: 10,000 Ft nettó ár + 27% ÁFA = 12,700 Ft bruttó ár</li>
            <li>Az ÁFA kulcsokat a ShopRenter webshopban is szinkronizálni kell a megfelelő adóosztályokhoz</li>
          </ul>
        </Typography>
      </Alert>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">ÁFA kulcs</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Példa számítás</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vatRates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs ÁFA kulcs létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenDialog()}
                    >
                      Hozzon létre első ÁFA kulcsot
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              vatRates.map((vat) => {
                const exampleNet = 10000
                const exampleGross = Math.round(exampleNet * (1 + vat.kulcs / 100))
                const exampleVat = exampleGross - exampleNet

                return (
                  <TableRow key={vat.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {vat.name}
                        </Typography>
                        {vat.kulcs === 0 && (
                          <Chip
                            label="ÁFA mentes"
                            size="small"
                            color="success"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {vat.kulcs.toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        <strong>{exampleNet.toLocaleString('hu-HU')} Ft</strong> nettó ={' '}
                        <strong>{exampleGross.toLocaleString('hu-HU')} Ft</strong> bruttó
                        <br />
                        <span style={{ fontSize: '0.85rem' }}>
                          (ÁFA: {exampleVat.toLocaleString('hu-HU')} Ft)
                        </span>
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="Szerkesztés">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(vat)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Törlés">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(vat)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingVat ? 'ÁFA kulcs szerkesztése' : 'Új ÁFA kulcs létrehozása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            <TextField
              label="ÁFA kulcs neve"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name || 'Példa: "ÁFA 27%", "ÁFA mentes", "ÁFA 18%"'}
              placeholder="ÁFA 27%"
            />
            <TextField
              label="ÁFA kulcs értéke (%)"
              type="number"
              value={formData.kulcs}
              onChange={(e) => setFormData(prev => ({ ...prev, kulcs: e.target.value }))}
              fullWidth
              required
              error={!!errors.kulcs}
              helperText={
                errors.kulcs ||
                'Az ÁFA kulcs százalékos értéke (0-100). Példa: 27 = 27%, 0 = ÁFA mentes'
              }
              inputProps={{ step: '0.01', min: '0', max: '100' }}
              InputProps={{
                endAdornment: <Typography variant="body2" sx={{ mr: 1 }}>%</Typography>
              }}
            />
            {formData.kulcs && !errors.kulcs && parseFloat(formData.kulcs) >= 0 && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Példa számítás:
                </Typography>
                <Typography variant="body2">
                  <strong>10,000 Ft</strong> nettó ár + <strong>{formData.kulcs}%</strong> ÁFA ={' '}
                  <strong>
                    {Math.round(10000 * (1 + parseFloat(formData.kulcs) / 100)).toLocaleString('hu-HU')} Ft
                  </strong>{' '}
                  bruttó ár
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingVat ? 'Frissítés' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné az <strong>"{deletingVat?.name}"</strong> ÁFA kulcsot?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! Ha vannak termékek, amelyek ezt az ÁFA kulcsot használják, azok továbbra is
              működni fognak, de az ÁFA kulcs törlés után nem lesz elérhető új termékekhez.
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

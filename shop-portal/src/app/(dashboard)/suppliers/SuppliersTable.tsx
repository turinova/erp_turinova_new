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
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface Supplier {
  id: string
  name: string
  short_name: string | null
  email: string | null
  phone: string | null
  status: string
  created_at: string
  updated_at: string
}

interface SuppliersTableProps {
  initialSuppliers: Supplier[]
}

export default function SuppliersTable({ initialSuppliers }: SuppliersTableProps) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDeleteDialog = (supplier: Supplier) => {
    setDeletingSupplier(supplier)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingSupplier(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(suppliers.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (supplierId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(supplierId)) {
      newSelected.delete(supplierId)
    } else {
      newSelected.add(supplierId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (supplier: Supplier) => {
    // Navigate to detail page
    router.push(`/suppliers/${supplier.id}`)
  }

  const isAllSelected = suppliers.length > 0 && selectedIds.size === suppliers.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < suppliers.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedSuppliers = suppliers.filter(s => selectedIds.has(s.id))
    if (selectedSuppliers.length === 1) {
      setDeletingSupplier(selectedSuppliers[0])
      setDeleteDialogOpen(true)
    } else {
      // For multiple, we'll delete the first one and show dialog
      setDeletingSupplier(selectedSuppliers[0])
      setDeleteDialogOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/suppliers/${deletingSupplier.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setSuppliers(prev => prev.filter(supplier => supplier.id !== deletingSupplier.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingSupplier.id)
        return newSet
      })
      toast.success('Beszállító sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting supplier:', error)
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
          Beszállítók kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a beszállítókat, akiktől termékeket vásárolhat. Minden beszállítóhoz megadhat címeket, banki adatokat, fizetési beállításokat és rendelési csatornákat.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a beszállítókról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Minden beszállítóhoz <strong>több címet</strong> adhat meg (székhely, számlázási, szállítási)</li>
            <li><strong>Több bankszámlát</strong> is megadhat, és kiválaszthatja az alapértelmezettet</li>
            <li>Beállíthatja a <strong>fizetési módot és határidőt</strong> (pl. 14 nap, 30 nap)</li>
            <li>Internetes rendeléshez <strong>URL sablonokat</strong> adhat meg (pl. webshop keresési linkek)</li>
            <li>E-mail sablonokat is beállíthat a rendelésekhez</li>
          </ul>
        </Typography>
      </Alert>

      {/* Action Buttons - Above Table */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'nowrap', alignItems: 'center' }}>
        {selectedIds.size > 0 && (
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
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/suppliers/new')}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új beszállító
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
                  disabled={suppliers.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Rövid név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>E-mail</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Telefon</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <LocalShippingIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Még nincs beszállító létrehozva
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => router.push('/suppliers/new')}
                    >
                      Hozzon létre első beszállítót
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow 
                  key={supplier.id} 
                  hover
                  selected={selectedIds.has(supplier.id)}
                  onClick={() => handleRowClick(supplier)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(supplier.id)}
                      onChange={(e) => handleSelectOne(supplier.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {supplier.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {supplier.short_name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {supplier.email || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {supplier.phone || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={supplier.status === 'active' ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        ...(supplier.status === 'active' 
                          ? { bgcolor: '#4caf50', color: 'white' }
                          : { bgcolor: '#f44336', color: 'white' }
                        )
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a <strong>"{deletingSupplier?.name}"</strong> beszállítót?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! A beszállító törlése után az összes kapcsolódó adat (címek, banki adatok, rendelési csatornák) is törlődik.
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

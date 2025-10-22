'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Checkbox,
  IconButton,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface QuoteAccessory {
  id: string
  accessory_name: string
  sku: string
  quantity: number
  base_price: number
  multiplier: number
  unit_price_net: number
  vat_rate: number
  unit_name: string
  total_net: number
  total_vat: number
  total_gross: number
  currency_id: string
}

interface QuoteAccessoriesSectionProps {
  quoteId: string
  accessories: QuoteAccessory[]
  onAccessoriesChange: () => void
  onAddAccessoryClick: () => void
}

export default function QuoteAccessoriesSection({
  quoteId,
  accessories,
  onAccessoriesChange,
  onAddAccessoryClick
}: QuoteAccessoriesSectionProps) {
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedAccessories(accessories.map(acc => acc.id))
    } else {
      setSelectedAccessories([])
    }
  }

  const handleSelectAccessory = (accessoryId: string) => {
    setSelectedAccessories(prev =>
      prev.includes(accessoryId)
        ? prev.filter(id => id !== accessoryId)
        : [...prev, accessoryId]
    )
  }

  const handleDeleteClick = () => {
    if (selectedAccessories.length === 0) {
      toast.warning('Válasszon ki legalább egy terméket a törléshez!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedAccessories.length === 0) return

    setIsDeleting(true)
    try {
      const deletePromises = selectedAccessories.map(accessoryId =>
        fetch(`/api/quotes/${quoteId}/accessories/${accessoryId}`, {
          method: 'DELETE',
        })
      )

      const results = await Promise.allSettled(deletePromises)
      const failedDeletions = results.filter(result =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value.ok)
      )

      if (failedDeletions.length === 0) {
        toast.success(`${selectedAccessories.length} termék sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
        })
        setSelectedAccessories([])
        onAccessoriesChange()
      } else {
        toast.error(`${failedDeletions.length} termék törlése sikertelen!`, {
          position: "top-right",
          autoClose: 5000,
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!', {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const isAllSelected = selectedAccessories.length === accessories.length && accessories.length > 0
  const isIndeterminate = selectedAccessories.length > 0 && selectedAccessories.length < accessories.length

  const totalNet = accessories.reduce((sum, acc) => sum + Number(acc.total_net), 0)
  const totalVat = accessories.reduce((sum, acc) => sum + Number(acc.total_vat), 0)
  const totalGross = accessories.reduce((sum, acc) => sum + Number(acc.total_gross), 0)

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Termékek</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedAccessories.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                  size="small"
                >
                  Törlés ({selectedAccessories.length})
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddAccessoryClick}
                size="small"
              >
                Termék hozzáadása
              </Button>
            </Box>
          </Box>

          {accessories.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Még nincsenek hozzáadott termékek
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={isIndeterminate}
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Termék neve</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell align="right">Mennyiség</TableCell>
                      <TableCell>Egység</TableCell>
                      <TableCell align="right">Nettó/egység</TableCell>
                      <TableCell align="right">Nettó összesen</TableCell>
                      <TableCell align="right">ÁFA</TableCell>
                      <TableCell align="right">Bruttó</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accessories.map((accessory) => (
                      <TableRow key={accessory.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedAccessories.includes(accessory.id)}
                            onChange={() => handleSelectAccessory(accessory.id)}
                          />
                        </TableCell>
                        <TableCell>{accessory.accessory_name}</TableCell>
                        <TableCell>{accessory.sku}</TableCell>
                        <TableCell align="right">{accessory.quantity}</TableCell>
                        <TableCell>{accessory.unit_name}</TableCell>
                        <TableCell align="right">{formatCurrency(accessory.unit_price_net)}</TableCell>
                        <TableCell align="right">{formatCurrency(accessory.total_net)}</TableCell>
                        <TableCell align="right">{formatCurrency(accessory.total_vat)}</TableCell>
                        <TableCell align="right">{formatCurrency(accessory.total_gross)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          Összesen:
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {formatCurrency(totalNet)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {formatCurrency(totalVat)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {formatCurrency(totalGross)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Termékek törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedAccessories.length} terméket?
            Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
            Mégse
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}


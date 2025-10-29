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

interface QuoteFee {
  id: string
  fee_name: string
  quantity: number
  unit_price_net: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency_id: string
  comment: string
}

interface QuoteFeesSectionProps {
  quoteId: string
  fees: QuoteFee[]
  onFeesChange: () => void
  onAddFeeClick: () => void
}

export default function QuoteFeesSection({
  quoteId,
  fees,
  onFeesChange,
  onAddFeeClick
}: QuoteFeesSectionProps) {
  const [selectedFees, setSelectedFees] = useState<string[]>([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedFees(fees.map(fee => fee.id))
    } else {
      setSelectedFees([])
    }
  }

  const handleSelectFee = (feeId: string) => {
    setSelectedFees(prev =>
      prev.includes(feeId)
        ? prev.filter(id => id !== feeId)
        : [...prev, feeId]
    )
  }

  const handleDeleteClick = () => {
    if (selectedFees.length === 0) {
      toast.warning('Válasszon ki legalább egy díjat a törléshez!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedFees.length === 0) return

    setIsDeleting(true)
    try {
      const deletePromises = selectedFees.map(feeId =>
        fetch(`/api/quotes/${quoteId}/fees/${feeId}`, {
          method: 'DELETE',
        })
      )

      const results = await Promise.allSettled(deletePromises)
      const failedDeletions = results.filter(result =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value.ok)
      )

      if (failedDeletions.length === 0) {
        toast.success(`${selectedFees.length} díj sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
        })
        setSelectedFees([])
        onFeesChange()
      } else {
        toast.error(`${failedDeletions.length} díj törlése sikertelen!`, {
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

  const isAllSelected = selectedFees.length === fees.length && fees.length > 0
  const isIndeterminate = selectedFees.length > 0 && selectedFees.length < fees.length

  const totalNet = fees.reduce((sum, fee) => {
    const feeNet = Number(fee.unit_price_net) * Number(fee.quantity || 1)
    return sum + feeNet
  }, 0)
  
  const totalVat = fees.reduce((sum, fee) => {
    const feeNet = Number(fee.unit_price_net) * Number(fee.quantity || 1)
    const feeVat = feeNet * Number(fee.vat_rate)
    return sum + feeVat
  }, 0)
  
  const totalGross = totalNet + totalVat

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Díjak</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedFees.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                  size="small"
                >
                  Törlés ({selectedFees.length})
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddFeeClick}
                size="small"
              >
                Díj hozzáadása
              </Button>
            </Box>
          </Box>

          {fees.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Még nincsenek hozzáadott díjak
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
                      <TableCell>Díj neve</TableCell>
                      <TableCell>Megjegyzés</TableCell>
                      <TableCell align="right">Mennyiség</TableCell>
                      <TableCell align="right">Egységár (Nettó)</TableCell>
                      <TableCell align="right">Összeg (Bruttó)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fees.map((fee) => (
                      <TableRow key={fee.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedFees.includes(fee.id)}
                            onChange={() => handleSelectFee(fee.id)}
                          />
                        </TableCell>
                        <TableCell>{fee.fee_name}</TableCell>
                        <TableCell>{fee.comment || '-'}</TableCell>
                        <TableCell align="right">{fee.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(fee.unit_price_net)}</TableCell>
                        <TableCell align="right">{formatCurrency(fee.gross_price)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          Összesen:
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
        <DialogTitle id="delete-dialog-title">Díjak törlése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan törölni szeretné a kiválasztott {selectedFees.length} díjat?
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


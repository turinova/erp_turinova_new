'use client'

import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface BankAccount {
  id: string
  bank_name: string
  account_number: string
  swift_bic: string | null
  currency_id: string | null
  is_default: boolean
}

interface BankAccountsCardProps {
  supplierId: string
  initialBankAccounts: BankAccount[]
  onUpdate: () => void
}

export default function BankAccountsCard({ supplierId, initialBankAccounts, onUpdate }: BankAccountsCardProps) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initialBankAccounts)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null)
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    swift_bic: '',
    currency_id: '',
    is_default: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        bank_name: account.bank_name,
        account_number: account.account_number,
        swift_bic: account.swift_bic || '',
        currency_id: account.currency_id || '',
        is_default: account.is_default
      })
    } else {
      setEditingAccount(null)
      setFormData({
        bank_name: '',
        account_number: '',
        swift_bic: '',
        currency_id: '',
        is_default: false
      })
    }
    setErrors({})
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingAccount(null)
    setFormData({
      bank_name: '',
      account_number: '',
      swift_bic: '',
      currency_id: '',
      is_default: false
    })
    setErrors({})
  }

  const handleOpenDeleteDialog = (account: BankAccount) => {
    setDeletingAccount(account)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingAccount(null)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.bank_name.trim()) {
      newErrors.bank_name = 'A bank neve kötelező'
    }
    if (!formData.account_number.trim()) {
      newErrors.account_number = 'A számlaszám kötelező'
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
      const url = editingAccount
        ? `/api/suppliers/${supplierId}/bank-accounts/${editingAccount.id}`
        : `/api/suppliers/${supplierId}/bank-accounts`
      const method = editingAccount ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bank_name: formData.bank_name.trim(),
          account_number: formData.account_number.trim(),
          swift_bic: formData.swift_bic.trim() || null,
          currency_id: formData.currency_id || null,
          is_default: formData.is_default
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      const updatedAccount = result.bank_account

      if (editingAccount) {
        // If setting as default, unset others
        if (formData.is_default) {
          setBankAccounts(prev =>
            prev.map(acc => ({
              ...acc,
              is_default: acc.id === editingAccount.id ? true : false
            }))
          )
        } else {
          setBankAccounts(prev =>
            prev.map(acc => (acc.id === editingAccount.id ? updatedAccount : acc))
          )
        }
        toast.success('Bankszámla sikeresen frissítve')
      } else {
        // If setting as default, unset others
        if (formData.is_default) {
          setBankAccounts(prev =>
            prev.map(acc => ({ ...acc, is_default: false })).concat(updatedAccount)
          )
        } else {
          setBankAccounts(prev => [...prev, updatedAccount])
        }
        toast.success('Bankszámla sikeresen hozzáadva')
      }

      handleCloseDialog()
      onUpdate()
    } catch (error) {
      console.error('Error saving bank account:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAccount) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/bank-accounts/${deletingAccount.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setBankAccounts(prev => prev.filter(acc => acc.id !== deletingAccount.id))
      toast.success('Bankszámla sikeresen törölve')
      handleCloseDeleteDialog()
      onUpdate()
    } catch (error) {
      console.error('Error deleting bank account:', error)
      toast.error(
        `Hiba a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Paper 
        elevation={0}
        sx={{ 
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#ff9800',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
            }}>
              <AccountBalanceIcon sx={{ color: 'white', fontSize: '24px' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
              Banki adatok
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              borderColor: '#ff9800',
              color: '#e65100',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#f57c00',
                bgcolor: '#fff3e0'
              }
            }}
          >
            Új bankszámla
          </Button>
        </Box>

        {bankAccounts.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Még nincs bankszámla hozzáadva
          </Typography>
        ) : (
          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{
              borderColor: '#ffe0b2',
              '& .MuiTableRow-root:hover': {
                bgcolor: '#fff8e1'
              }
            }}
          >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#fff8e1' }}>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Bank neve</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Számlaszám</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>SWIFT/BIC</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.875rem' }}>Alapértelmezett</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 1, width: 100, fontSize: '0.875rem' }}>Műveletek</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bankAccounts.map((account) => (
                    <TableRow key={account.id} hover>
                      <TableCell sx={{ py: 1 }}>{account.bank_name}</TableCell>
                      <TableCell sx={{ py: 1 }}>{account.account_number}</TableCell>
                      <TableCell sx={{ py: 1 }}>{account.swift_bic || '-'}</TableCell>
                      <TableCell sx={{ py: 1 }}>
                        {account.is_default && (
                          <Chip 
                            label="Alapértelmezett" 
                            size="small" 
                            sx={{
                              bgcolor: '#ff9800',
                              color: 'white',
                              fontWeight: 500
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(account)}
                          sx={{ mr: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleOpenDeleteDialog(account)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAccount ? 'Bankszámla szerkesztése' : 'Új bankszámla hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Bank neve *"
              value={formData.bank_name}
              onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
              fullWidth
              required
              error={!!errors.bank_name}
              helperText={errors.bank_name}
            />

            <TextField
              label="Számlaszám / IBAN *"
              value={formData.account_number}
              onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
              fullWidth
              required
              error={!!errors.account_number}
              helperText={errors.account_number}
            />

            <TextField
              label="SWIFT/BIC"
              value={formData.swift_bic}
              onChange={(e) => setFormData(prev => ({ ...prev, swift_bic: e.target.value }))}
              fullWidth
              helperText="Opcionális SWIFT vagy BIC kód"
            />

            <TextField
              label="Pénznem"
              value={formData.currency_id}
              onChange={(e) => setFormData(prev => ({ ...prev, currency_id: e.target.value }))}
              fullWidth
              helperText="Pénznem ID (jelenleg szöveges mező, később dropdown lesz)"
              disabled
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                />
              }
              label="Alapértelmezett bankszámla"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Mentés...' : editingAccount ? 'Frissítés' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Törlés megerősítése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné ezt a bankszámlát?
          </Typography>
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
    </>
  )
}

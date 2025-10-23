'use client'

import React, { useState, useMemo, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Chip } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface PaymentMethod {
  id: string
  name: string
  comment: string | null
  active: boolean
  created_at: string
  updated_at: string
}

interface PaymentMethodsListClientProps {
  initialPaymentMethods: PaymentMethod[]
}

export default function PaymentMethodsListClient({ initialPaymentMethods }: PaymentMethodsListClientProps) {
  const router = useRouter()
  
  // Check permission for this page
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/payment-methods')
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter payment methods based on search term (search by name only)
  const filteredPaymentMethods = useMemo(() => {
    if (!paymentMethods || !Array.isArray(paymentMethods)) return []
    if (!searchTerm) return paymentMethods
    
    const term = searchTerm.toLowerCase()
    return paymentMethods.filter(pm => 
      pm.name.toLowerCase().includes(term)
    )
  }, [paymentMethods, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedPaymentMethods(filteredPaymentMethods.map(pm => pm.id))
    } else {
      setSelectedPaymentMethods([])
    }
  }

  const handleSelectPaymentMethod = (paymentMethodId: string) => {
    setSelectedPaymentMethods(prev => 
      prev.includes(paymentMethodId) 
        ? prev.filter(id => id !== paymentMethodId)
        : [...prev, paymentMethodId]
    )
  }

  const isAllSelected = selectedPaymentMethods.length === filteredPaymentMethods.length && filteredPaymentMethods.length > 0
  const isIndeterminate = selectedPaymentMethods.length > 0 && selectedPaymentMethods.length < filteredPaymentMethods.length

  const handleRowClick = (paymentMethodId: string) => {
    router.push(`/payment-methods/${paymentMethodId}`)
  }

  const handleAddNewPaymentMethod = () => {
    router.push('/payment-methods/new')
  }

  const handleDeleteClick = () => {
    if (selectedPaymentMethods.length === 0) {
      toast.warning('Válasszon ki legalább egy fizetési módot a törléshez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      
      return
    }

    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedPaymentMethods.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete payment methods one by one
      const deletePromises = selectedPaymentMethods.map(paymentMethodId => 
        fetch(`/api/payment-methods/${paymentMethodId}`, {
          method: 'DELETE',
        })
      )
      
      const results = await Promise.allSettled(deletePromises)
      
      // Check if all deletions were successful
      const failedDeletions = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok)
      )
      
      if (failedDeletions.length === 0) {
        // All deletions successful
        toast.success(`${selectedPaymentMethods.length} fizetési mód sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache and refresh data
        invalidateApiCache('/api/payment-methods')
        
        // Update local state by removing deleted payment methods
        setPaymentMethods(prev => prev.filter(pm => !selectedPaymentMethods.includes(pm.id)))
        setSelectedPaymentMethods([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} fizetési mód törlése sikertelen!`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Hiba történt a törlés során!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
  }

  // Check access permission - only redirect if permissions are loaded and user doesn't have access
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      const timer = setTimeout(() => {
        toast.error('Nincs jogosultsága a Fizetési módok oldal megtekintéséhez!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/home')
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [hasAccess, permissionsLoading, router])

  // Show loading state while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a Fizetési módok oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Fizetési módok
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedPaymentMethods.length === 0}
        >
          Törlés ({selectedPaymentMethods.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewPaymentMethod}
        >
          Új fizetési mód hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név szerint..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Megjegyzés</TableCell>
              <TableCell>Aktív</TableCell>
              <TableCell>Létrehozva</TableCell>
              <TableCell>Frissítve</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPaymentMethods.map((pm) => (
              <TableRow 
                key={pm.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(pm.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedPaymentMethods.includes(pm.id)}
                    onChange={() => handleSelectPaymentMethod(pm.id)}
                  />
                </TableCell>
                <TableCell>{pm.name}</TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      maxWidth: 300, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pm.comment || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={pm.active ? 'Aktív' : 'Inaktív'} 
                    color={pm.active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{new Date(pm.created_at).toLocaleDateString('hu-HU')}</TableCell>
                <TableCell>{new Date(pm.updated_at).toLocaleDateString('hu-HU')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Fizetési módok törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedPaymentMethods.length} fizetési módot? 
            Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            disabled={isDeleting}
          >
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
    </Box>
  )
}


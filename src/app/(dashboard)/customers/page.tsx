'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  discount_percent: number
}

export default function UgyfelekPage() {
  const router = useRouter()
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch customers from API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true)
        // Try to fetch from Supabase first
        const response = await fetch('/api/customers')
        if (response.ok) {
          const data = await response.json()
          setCustomers(data)
        } else {
          // Fallback to sample data if API fails
          setCustomers([
            {
              id: 'b016c425-ff23-4340-98b6-55148c597b7a',
              name: 'Kovács Péter',
              email: 'peter.kovacs@example.com',
              mobile: '+36 30 123 4567',
              discount_percent: 5.00
            },
            {
              id: 'fcee2e83-beb7-4bc0-b2d1-05b76f1bf681',
              name: 'Nagy Zsófia',
              email: 'zsofia.nagy@example.com',
              mobile: '+36 20 765 4321',
              discount_percent: 0.00
            }
          ])
        }
      } catch (error) {
        console.error('Failed to fetch customers:', error)
        // Fallback to sample data with real UUIDs
        setCustomers([
          {
            id: 'b016c425-ff23-4340-98b6-55148c597b7a',
            name: 'Kovács Péter',
            email: 'peter.kovacs@example.com',
            mobile: '+36 30 123 4567',
            discount_percent: 5.00
          },
          {
            id: 'fcee2e83-beb7-4bc0-b2d1-05b76f1bf681',
            name: 'Nagy Zsófia',
            email: 'zsofia.nagy@example.com',
            mobile: '+36 20 765 4321',
            discount_percent: 0.00
          }
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomers()
  }, [])

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers
    
    const term = searchTerm.toLowerCase()
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(term) ||
      customer.email.toLowerCase().includes(term) ||
      customer.mobile.toLowerCase().includes(term)
    )
  }, [customers, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedCustomers(filteredCustomers.map(customer => customer.id))
    } else {
      setSelectedCustomers([])
    }
  }

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    )
  }

  const isAllSelected = selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0
  const isIndeterminate = selectedCustomers.length > 0 && selectedCustomers.length < filteredCustomers.length

  const handleRowClick = (customerId: string) => {
    router.push(`/customers/${customerId}`)
  }

  const handleAddNewCustomer = () => {
    router.push('/customers/new')
  }

  const handleDeleteClick = () => {
    if (selectedCustomers.length === 0) {
      toast.warning('Válasszon ki legalább egy ügyfelet a törléshez!', {
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
    if (selectedCustomers.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete customers one by one
      const deletePromises = selectedCustomers.map(customerId => 
        fetch(`/api/customers/${customerId}`, {
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
        toast.success(`${selectedCustomers.length} ügyfél sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Remove deleted customers from local state
        setCustomers(prev => prev.filter(customer => !selectedCustomers.includes(customer.id)))
        setSelectedCustomers([])
      } else {
        // Some deletions failed
        toast.error(`${failedDeletions.length} ügyfél törlése sikertelen!`, {
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

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Ügyfelek betöltése...</Typography>
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
          Ügyfelek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedCustomers.length === 0}
        >
          Törlés ({selectedCustomers.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewCustomer}
        >
          Új ügyfél hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név, e-mail vagy telefonszám szerint..."
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
              <TableCell>E-mail</TableCell>
              <TableCell>Telefonszám</TableCell>
              <TableCell>Kedvezmény</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow 
                key={customer.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(customer.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCustomers.includes(customer.id)}
                    onChange={() => handleSelectCustomer(customer.id)}
                  />
                </TableCell>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.mobile}</TableCell>
                <TableCell>{customer.discount_percent}%</TableCell>
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
          Ügyfelek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedCustomers.length} ügyfelet? 
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

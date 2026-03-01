'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Chip, CircularProgress, LinearProgress } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Tenant {
  id: string
  name: string
  slug: string
  is_active: boolean
  supabase_url: string
  supabase_anon_key: string
  subscription_status?: string
  subscription_plan?: {
    id: string
    name: string
    slug: string
    ai_credits_per_month: number
  } | null
  credit_usage?: number
  credit_limit?: number
  created_at: string
  updated_at: string
}

interface TenantsListClientProps {
  initialTenants: Tenant[]
}

export default function TenantsListClient({ initialTenants }: TenantsListClientProps) {
  const router = useRouter()
  
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [selectedTenants, setSelectedTenants] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter tenants based on search term
  const filteredTenants = useMemo(() => {
    if (!tenants || !Array.isArray(tenants)) return []
    if (!searchTerm) return tenants
    
    const term = searchTerm.toLowerCase()
    return tenants.filter(tenant => 
      tenant.name.toLowerCase().includes(term) ||
      tenant.slug.toLowerCase().includes(term)
    )
  }, [tenants, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTenants(filteredTenants.map(tenant => tenant.id))
    } else {
      setSelectedTenants([])
    }
  }

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenants(prev => 
      prev.includes(tenantId) 
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    )
  }

  const isAllSelected = selectedTenants.length === filteredTenants.length && filteredTenants.length > 0
  const isIndeterminate = selectedTenants.length > 0 && selectedTenants.length < filteredTenants.length

  const handleRowClick = (tenantId: string) => {
    router.push(`/tenants/${tenantId}`)
  }

  const handleAddNewTenant = () => {
    router.push('/tenants/new')
  }

  const handleDeleteClick = () => {
    if (selectedTenants.length === 0) {
      toast.warning('Válasszon ki legalább egy ügyfelet a törléshez!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedTenants.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete tenants one by one
      const deletePromises = selectedTenants.map(tenantId => 
        fetch(`/api/tenants/${tenantId}`, {
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
        toast.success(`${selectedTenants.length} ügyfél sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
        })
        
        // Update local state by removing deleted tenants
        setTenants(prev => prev.filter(tenant => !selectedTenants.includes(tenant.id)))
        setSelectedTenants([])
      } else {
        toast.error(`${failedDeletions.length} ügyfél törlése sikertelen!`, {
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

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
  }

  const getStatusChip = (isActive: boolean) => {
    return isActive 
      ? <Chip label="Aktív" color="success" size="small" />
      : <Chip label="Inaktív" color="error" size="small" />
  }

  const getSubscriptionChip = (status?: string) => {
    if (!status) return <Chip label="Nincs" color="default" size="small" />
    
    switch (status) {
      case 'active':
        return <Chip label="Aktív" color="success" size="small" />
      case 'trial':
        return <Chip label="Próba" color="info" size="small" />
      case 'canceled':
        return <Chip label="Megszakítva" color="warning" size="small" />
      case 'expired':
        return <Chip label="Lejárt" color="error" size="small" />
      default:
        return <Chip label={status} color="default" size="small" />
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Kezdőlap
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
          disabled={selectedTenants.length === 0}
        >
          Törlés ({selectedTenants.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewTenant}
        >
          Új ügyfél hozzáadása
        </Button>
      </Box>
      
      <TextField
        fullWidth
        placeholder="Keresés név vagy slug szerint..."
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
              <TableCell>Slug</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Előfizetés</TableCell>
              <TableCell>Előfizetési terv</TableCell>
              <TableCell align="right">Turitoken</TableCell>
              <TableCell>Létrehozva</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTenants.map((tenant) => (
              <TableRow 
                key={tenant.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(tenant.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedTenants.includes(tenant.id)}
                    onChange={() => handleSelectTenant(tenant.id)}
                  />
                </TableCell>
                <TableCell>{tenant.name}</TableCell>
                <TableCell>{tenant.slug}</TableCell>
                <TableCell>{getStatusChip(tenant.is_active)}</TableCell>
                <TableCell>{getSubscriptionChip(tenant.subscription_status)}</TableCell>
                <TableCell>{tenant.subscription_plan?.name || 'Nincs'}</TableCell>
                <TableCell align="right">
                  {tenant.credit_usage !== undefined && tenant.credit_limit !== undefined && tenant.credit_limit !== null ? (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {tenant.credit_usage} / {tenant.credit_limit}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={tenant.credit_limit > 0 ? Math.min(100, (tenant.credit_usage / tenant.credit_limit) * 100) : 0}
                        color={tenant.credit_limit > 0 && tenant.credit_usage / tenant.credit_limit > 0.9 ? 'error' : tenant.credit_limit > 0 && tenant.credit_usage / tenant.credit_limit > 0.7 ? 'warning' : 'success'}
                        sx={{ height: 4, borderRadius: 2, width: 60 }}
                      />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(tenant.created_at).toLocaleDateString('hu-HU')}
                  </Typography>
                </TableCell>
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
            Biztosan törölni szeretné a kiválasztott {selectedTenants.length} ügyfelet? 
            Ez a művelet nem vonható vissza (soft delete).
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

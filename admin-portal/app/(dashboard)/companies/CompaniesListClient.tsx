'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Checkbox, TextField, InputAdornment, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Chip, CircularProgress } from '@mui/material'
import { Search as SearchIcon, Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Company {
  id: string
  name: string
  slug: string
  is_active: boolean
  supabase_url: string
  supabase_anon_key: string
  created_at: string
  updated_at: string
  logo_url?: string
  settings?: any
  customer_count?: number
  quote_count?: number
  last_activity?: string
}

interface CompaniesListClientProps {
  initialCompanies: Company[]
}

export default function CompaniesListClient({ initialCompanies }: CompaniesListClientProps) {
  const router = useRouter()
  
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    if (!companies || !Array.isArray(companies)) return []
    if (!searchTerm) return companies
    
    const term = searchTerm.toLowerCase()
    return companies.filter(company => 
      company.name.toLowerCase().includes(term) ||
      company.slug.toLowerCase().includes(term)
    )
  }, [companies, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedCompanies(filteredCompanies.map(company => company.id))
    } else {
      setSelectedCompanies([])
    }
  }

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  const isAllSelected = selectedCompanies.length === filteredCompanies.length && filteredCompanies.length > 0
  const isIndeterminate = selectedCompanies.length > 0 && selectedCompanies.length < filteredCompanies.length

  const handleRowClick = (companyId: string) => {
    router.push(`/companies/${companyId}`)
  }

  const handleAddNewCompany = () => {
    router.push('/companies/new')
  }

  const handleDeleteClick = () => {
    if (selectedCompanies.length === 0) {
      toast.warning('Válasszon ki legalább egy céget a törléshez!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedCompanies.length === 0) return
    
    setIsDeleting(true)
    
    try {
      // Delete companies one by one
      const deletePromises = selectedCompanies.map(companyId => 
        fetch(`/api/companies/${companyId}`, {
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
        toast.success(`${selectedCompanies.length} cég sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
        })
        
        // Update local state by removing deleted companies
        setCompanies(prev => prev.filter(company => !selectedCompanies.includes(company.id)))
        setSelectedCompanies([])
      } else {
        toast.error(`${failedDeletions.length} cég törlése sikertelen!`, {
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
          Cégek
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          color="error"
          onClick={handleDeleteClick}
          disabled={selectedCompanies.length === 0}
        >
          Törlés ({selectedCompanies.length})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          color="primary"
          onClick={handleAddNewCompany}
        >
          Új cég hozzáadása
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
              <TableCell align="right">Ügyfelek</TableCell>
              <TableCell align="right">Árajánlatok</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCompanies.map((company) => (
              <TableRow 
                key={company.id} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(company.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCompanies.includes(company.id)}
                    onChange={() => handleSelectCompany(company.id)}
                  />
                </TableCell>
                <TableCell>{company.name}</TableCell>
                <TableCell>{company.slug}</TableCell>
                <TableCell>{getStatusChip(company.is_active)}</TableCell>
                <TableCell align="right">{company.customer_count || 0}</TableCell>
                <TableCell align="right">{company.quote_count || 0}</TableCell>
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
          Cégek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedCompanies.length} céget? 
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


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
  Alert,
  Checkbox,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  CloudSync as CloudSyncIcon,
  Create as CreateIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface Company {
  id: string
  name: string
  email: string | null
  telephone: string | null
  identifier: string | null
  source: 'local' | 'webshop_sync'
  is_active: boolean
  tax_number: string | null
  created_at: string
  updated_at: string
  customer_groups: {
    id: string
    name: string
  } | null
}

interface CompaniesTableProps {
  initialCompanies: Company[]
}

export default function CompaniesTable({ initialCompanies }: CompaniesTableProps) {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>(initialCompanies)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'webshop_sync'>('all')

  // Filter companies based on search and filters
  React.useEffect(() => {
    let filtered = companies

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.identifier?.toLowerCase().includes(query) ||
        c.tax_number?.toLowerCase().includes(query)
      )
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(c => c.source === sourceFilter)
    }

    setFilteredCompanies(filtered)
  }, [companies, searchQuery, sourceFilter])

  const handleOpenDeleteDialog = (company: Company) => {
    setDeletingCompany(company)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingCompany(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (companyId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId)
    } else {
      newSelected.add(companyId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (company: Company) => {
    router.push(`/customers/companies/${company.id}`)
  }

  const isAllSelected = filteredCompanies.length > 0 && selectedIds.size === filteredCompanies.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredCompanies.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedCompanies = filteredCompanies.filter(c => selectedIds.has(c.id))
    if (selectedCompanies.length === 1) {
      setDeletingCompany(selectedCompanies[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingCompany(selectedCompanies[0])
      setDeleteDialogOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!deletingCompany) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/customers/companies/${deletingCompany.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setCompanies(prev => prev.filter(company => company.id !== deletingCompany.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingCompany.id)
        return newSet
      })
      toast.success('Cég sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting company:', error)
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
          Cégek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a cégeket. Minden céghez megadhat címeket, bankszámlákat, és kapcsolhatja őket vevőcsoportokhoz vagy személyekhez.
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Keresés név, e-mail, adószám szerint..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button
          variant={sourceFilter === 'local' ? 'contained' : 'outlined'}
          onClick={() => setSourceFilter(sourceFilter === 'local' ? 'all' : 'local')}
          startIcon={<CreateIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Helyi
        </Button>
        <Button
          variant={sourceFilter === 'webshop_sync' ? 'contained' : 'outlined'}
          onClick={() => setSourceFilter(sourceFilter === 'webshop_sync' ? 'all' : 'webshop_sync')}
          startIcon={<CloudSyncIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Webshop
        </Button>
      </Box>

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
          onClick={() => router.push('/customers/companies/new')}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új cég
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
                  disabled={filteredCompanies.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>E-mail</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Telefon</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Adószám</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Forrás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <BusinessIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchQuery || sourceFilter !== 'all'
                        ? 'Nincs találat a szűrési feltételeknek megfelelően'
                        : 'Még nincs cég létrehozva'}
                    </Typography>
                    {!searchQuery && sourceFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/customers/companies/new')}
                      >
                        Hozzon létre első céget
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map((company) => (
                <TableRow 
                  key={company.id} 
                  hover
                  selected={selectedIds.has(company.id)}
                  onClick={() => handleRowClick(company)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(company.id)}
                      onChange={(e) => handleSelectOne(company.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {company.name}
                    </Typography>
                    {company.identifier && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        ID: {company.identifier}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {company.email || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {company.telephone || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {company.tax_number || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      icon={company.source === 'local' ? <CreateIcon /> : <CloudSyncIcon />}
                      label={company.source === 'local' ? 'Helyi' : 'Webshop'}
                      size="small"
                      sx={{
                        bgcolor: company.source === 'local' ? '#4caf50' : '#9c27b0',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {company.customer_groups?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={company.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        ...(company.is_active 
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
            Biztosan törölni szeretné a <strong>"{deletingCompany?.name}"</strong> céget?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! A cég törlése után az összes kapcsolódó adat (címek, bankszámlák, személy kapcsolatok) is törlődik.
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

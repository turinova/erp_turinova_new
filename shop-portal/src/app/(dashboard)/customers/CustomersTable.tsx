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
  Info as InfoIcon,
  People as PeopleIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  CloudSync as CloudSyncIcon,
  Create as CreateIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

interface Customer {
  id: string
  entity_type: 'person' | 'company'
  name: string
  email: string | null
  telephone: string | null
  identifier: string | null
  source: 'local' | 'webshop_sync'
  is_active: boolean
  firstname: string | null
  lastname: string | null
  tax_number: string | null
  created_at: string
  updated_at: string
  customer_groups: {
    id: string
    name: string
  } | null
}

interface CustomersTableProps {
  initialCustomers: Customer[]
}

export default function CustomersTable({ initialCustomers }: CustomersTableProps) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>(initialCustomers)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'person' | 'company'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'webshop_sync'>('all')

  // Filter customers based on search and filters
  React.useEffect(() => {
    let filtered = customers

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.identifier?.toLowerCase().includes(query) ||
        c.firstname?.toLowerCase().includes(query) ||
        c.lastname?.toLowerCase().includes(query) ||
        c.tax_number?.toLowerCase().includes(query)
      )
    }

    // Entity type filter
    if (entityTypeFilter !== 'all') {
      filtered = filtered.filter(c => c.entity_type === entityTypeFilter)
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(c => c.source === sourceFilter)
    }

    setFilteredCustomers(filtered)
  }, [customers, searchQuery, entityTypeFilter, sourceFilter])

  const handleOpenDeleteDialog = (customer: Customer) => {
    setDeletingCustomer(customer)
    setDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingCustomer(null)
  }

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (customerId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId)
    } else {
      newSelected.add(customerId)
    }
    setSelectedIds(newSelected)
  }

  const handleRowClick = (customer: Customer) => {
    router.push(`/customers/${customer.id}`)
  }

  const isAllSelected = filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredCustomers.length

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    const selectedCustomers = filteredCustomers.filter(c => selectedIds.has(c.id))
    if (selectedCustomers.length === 1) {
      setDeletingCustomer(selectedCustomers[0])
      setDeleteDialogOpen(true)
    } else {
      setDeletingCustomer(selectedCustomers[0])
      setDeleteDialogOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!deletingCustomer) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/customers/${deletingCustomer.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a törlés során')
      }

      setCustomers(prev => prev.filter(customer => customer.id !== deletingCustomer.id))
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(deletingCustomer.id)
        return newSet
      })
      toast.success('Vevő sikeresen törölve')
      handleCloseDeleteDialog()
    } catch (error) {
      console.error('Error deleting customer:', error)
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
          Vevők és cégek kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt kezelheti a vevőket és cégeket. Minden vevőhöz megadhat címeket, bankszámlákat, és kapcsolhatja őket vevőcsoportokhoz. A webshop-ból szinkronizált vevők automatikusan megjelennek itt.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk a vevőkről:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Különbséget teszünk <strong>személyek</strong> és <strong>cégek</strong> között</li>
            <li>Vevők lehetnek <strong>helyileg létrehozottak</strong> vagy <strong>webshop-ból szinkronizáltak</strong></li>
            <li>Minden vevőhöz <strong>több címet</strong> adhat meg (számlázási, szállítási, székhely, levelezési)</li>
            <li><strong>Több bankszámlát</strong> is megadhat (főleg cégeknél)</li>
            <li>Vevőket <strong>vevőcsoportokhoz</strong> kapcsolhat, ami az árazást befolyásolja</li>
          </ul>
        </Typography>
      </Alert>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Keresés név, e-mail, azonosító szerint..."
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
          variant={entityTypeFilter === 'all' ? 'contained' : 'outlined'}
          onClick={() => setEntityTypeFilter('all')}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Összes
        </Button>
        <Button
          variant={entityTypeFilter === 'person' ? 'contained' : 'outlined'}
          onClick={() => setEntityTypeFilter('person')}
          startIcon={<PersonIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Személyek
        </Button>
        <Button
          variant={entityTypeFilter === 'company' ? 'contained' : 'outlined'}
          onClick={() => setEntityTypeFilter('company')}
          startIcon={<BusinessIcon />}
          size="small"
          sx={{ whiteSpace: 'nowrap' }}
        >
          Cégek
        </Button>
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
          onClick={() => router.push('/customers/new')}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', ml: 'auto' }}
        >
          Új vevő
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
                  disabled={filteredCustomers.length === 0}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Típus</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>E-mail</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Telefon</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Forrás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PeopleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      {searchQuery || entityTypeFilter !== 'all' || sourceFilter !== 'all'
                        ? 'Nincs találat a szűrési feltételeknek megfelelően'
                        : 'Még nincs vevő létrehozva'}
                    </Typography>
                    {!searchQuery && entityTypeFilter === 'all' && sourceFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/customers/new')}
                      >
                        Hozzon létre első vevőt
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow 
                  key={customer.id} 
                  hover
                  selected={selectedIds.has(customer.id)}
                  onClick={() => handleRowClick(customer)}
                  sx={{ cursor: 'pointer', '& td': { py: 1 } }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ width: 40, py: 1 }}>
                    <Checkbox
                      checked={selectedIds.has(customer.id)}
                      onChange={(e) => handleSelectOne(customer.id, e)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      icon={customer.entity_type === 'person' ? <PersonIcon /> : <BusinessIcon />}
                      label={customer.entity_type === 'person' ? 'Személy' : 'Cég'}
                      size="small"
                      sx={{
                        bgcolor: customer.entity_type === 'person' ? '#2196f3' : '#ff9800',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {customer.name}
                    </Typography>
                    {customer.identifier && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        ID: {customer.identifier}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {customer.email || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {customer.telephone || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      icon={customer.source === 'local' ? <CreateIcon /> : <CloudSyncIcon />}
                      label={customer.source === 'local' ? 'Helyi' : 'Webshop'}
                      size="small"
                      sx={{
                        bgcolor: customer.source === 'local' ? '#4caf50' : '#9c27b0',
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {customer.customer_groups?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={customer.is_active ? 'Aktív' : 'Inaktív'}
                      size="small"
                      sx={{
                        ...(customer.is_active 
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
            Biztosan törölni szeretné a <strong>"{deletingCustomer?.name}"</strong> vevőt?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Figyelem! A vevő törlése után az összes kapcsolódó adat (címek, bankszámlák) is törlődik.
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

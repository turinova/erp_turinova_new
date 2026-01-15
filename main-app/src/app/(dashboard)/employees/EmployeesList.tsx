'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableContainer, 
  Paper,
  Checkbox,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material'
import { Home as HomeIcon, Search as SearchIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Employee {
  id: string
  name: string
  employee_code: string
  rfid_card_id: string | null
  pin_code: string | null
  active: boolean
  lunch_break_start: string | null
  lunch_break_end: string | null
  works_on_saturday: boolean
  created_at: string
  updated_at: string
}

interface EmployeesListProps {
  initialEmployees: Employee[]
}

export default function EmployeesList({ initialEmployees }: EmployeesListProps) {
  const router = useRouter()
  
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!employees || !Array.isArray(employees)) return []
    if (!searchTerm) return employees
    
    const term = searchTerm.toLowerCase()
    return employees.filter(employee => 
      employee.name.toLowerCase().includes(term) ||
      employee.employee_code.toLowerCase().includes(term)
    )
  }, [employees, searchTerm])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedEmployees(filteredEmployees.map(employee => employee.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const isAllSelected = selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0
  const isIndeterminate = selectedEmployees.length > 0 && selectedEmployees.length < filteredEmployees.length

  const handleRowClick = (employeeId: string) => {
    router.push(`/employees/${employeeId}`)
  }

  const handleDeleteClick = () => {
    if (selectedEmployees.length === 0) return
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      const deletePromises = selectedEmployees.map(employeeId => 
        fetch(`/api/employees/${employeeId}`, {
          method: 'DELETE',
        })
      )
      
      const results = await Promise.allSettled(deletePromises)
      
      const failedDeletions = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.ok)
      )
      
      if (failedDeletions.length === 0) {
        toast.success(`${selectedEmployees.length} kolléga sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        invalidateApiCache('/api/employees')
        setSelectedEmployees([])
        setDeleteDialogOpen(false)
        
        // Refresh from server
        router.refresh()
      } else {
        toast.error(`${failedDeletions.length} kolléga törlése sikertelen!`, {
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
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          href="/"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Kollégák
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Kollégák
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedEmployees.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              Törlés ({selectedEmployees.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            href="/employees/new"
            sx={{
              backgroundColor: '#000000',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#333333',
              }
            }}
          >
            Új kolléga hozzáadása
          </Button>
        </Box>
      </Box>
      
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Keresés név vagy kód szerint..."
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
      
      {/* Employees Table */}
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
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmployees.map((employee) => (
              <TableRow 
                key={employee.id} 
                hover 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => handleRowClick(employee.id)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => handleSelectEmployee(employee.id)}
                  />
                </TableCell>
                <TableCell>{employee.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {searchTerm ? 'Nincs találat' : 'Nincs dolgozó'}
          </Typography>
          {!searchTerm && (
            <Typography variant="body2" color="text.secondary">
              Még nincsenek hozzáadva dolgozók
            </Typography>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Kollégák törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedEmployees.length} kollégát? Ez a művelet nem vonható vissza.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            Mégse
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

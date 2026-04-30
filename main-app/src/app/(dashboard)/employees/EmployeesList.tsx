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
  MenuItem,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material'
import { Home as HomeIcon, Search as SearchIcon, Add as AddIcon, Delete as DeleteIcon, PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Employee {
  id: string
  name: string
  employee_code: string
  employee_type?: string
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportOfficialDialogOpen, setExportOfficialDialogOpen] = useState(false)
  const now = new Date()
  const [exportYear, setExportYear] = useState<number>(now.getFullYear())
  const [exportMonth, setExportMonth] = useState<number>(now.getMonth() + 1)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingOfficial, setIsExportingOfficial] = useState(false)

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!employees || !Array.isArray(employees)) return []
    if (!searchTerm) return employees
    
    const term = searchTerm.toLowerCase()
    return employees.filter(employee => 
      employee.name.toLowerCase().includes(term) ||
      employee.employee_code.toLowerCase().includes(term) ||
      (employee.employee_type ? getEmployeeTypeLabel(employee.employee_type).toLowerCase().includes(term) : false)
    )
  }, [employees, searchTerm])

  const getEmployeeTypeLabel = (type: string) => {
    switch (type) {
      case 'BOLTI_DOLGOZO':
        return 'Bolti Dolgozó'
      case 'LAPSZABASZ':
        return 'Lapszabász'
      case 'ELZARO':
        return 'Élzáró'
      case 'ASZTALOS':
        return 'Asztalos'
      case 'IRODA':
        return 'Iroda'
      case 'MUHELY':
      default:
        return 'Műhely'
    }
  }

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

  const handleExportClick = () => {
    if (selectedEmployees.length === 0) return
    setExportDialogOpen(true)
  }

  const handleExportOfficialClick = () => {
    if (selectedEmployees.length === 0) return
    setExportOfficialDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const handleExportCancel = () => {
    if (isExporting) return
    setExportDialogOpen(false)
  }

  const handleExportOfficialCancel = () => {
    if (isExportingOfficial) return
    setExportOfficialDialogOpen(false)
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

  const parseFilenameFromContentDisposition = (value: string | null): string | null => {
    if (!value) return null
    const filenameStar = value.match(/filename\*\=UTF-8''([^;]+)/i)
    if (filenameStar?.[1]) return decodeURIComponent(filenameStar[1].replace(/"/g, ''))
    const filename = value.match(/filename=\"([^\"]+)\"/i)
    if (filename?.[1]) return filename[1]
    return null
  }

  const handleExportConfirm = async () => {
    if (selectedEmployees.length === 0) return
    setIsExporting(true)
    try {
      const res = await fetch('/api/employees/attendance/pdf/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
          year: exportYear,
          month: exportMonth
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Hiba történt az export során')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename =
        parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ||
        `Jelenleti-ivek-${exportYear}-${String(exportMonth).padStart(2, '0')}.zip`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success(`PDF export elkészült (${selectedEmployees.length} kolléga)`, {
        position: 'top-right',
        autoClose: 4000
      })
      setExportDialogOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Hiba történt az export során!', {
        position: 'top-right',
        autoClose: 6000
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportOfficialConfirm = async () => {
    if (selectedEmployees.length === 0) return
    setIsExportingOfficial(true)
    try {
      const res = await fetch('/api/employees/attendance/pdf/bulk-official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
          year: exportYear,
          month: exportMonth
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Hiba történt az export során')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename =
        parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ||
        `Jelenleti-ivek-${exportYear}-${String(exportMonth).padStart(2, '0')}.zip`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success(`Hivatalos jelenléti ívek elkészültek (${selectedEmployees.length} kolléga)`, {
        position: 'top-right',
        autoClose: 4500
      })
      setExportOfficialDialogOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Hiba történt az export során!', {
        position: 'top-right',
        autoClose: 6000
      })
    } finally {
      setIsExportingOfficial(false)
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
            <Tooltip title={`PDF export (papír) (${selectedEmployees.length})`}>
              <span>
                <IconButton onClick={handleExportClick} disabled={isExporting || isDeleting} aria-label="PDF export (papír)">
                  <PictureAsPdfIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {selectedEmployees.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleExportOfficialClick}
              disabled={isExportingOfficial || isDeleting}
            >
              PDF export ({selectedEmployees.length})
            </Button>
          )}
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
              <TableCell>Munkakör</TableCell>
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
                <TableCell>{getEmployeeTypeLabel(employee.employee_type || 'MUHELY')}</TableCell>
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

      {/* Bulk PDF Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleExportCancel}
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-description"
      >
        <DialogTitle id="export-dialog-title">PDF export</DialogTitle>
        <DialogContent>
          <DialogContentText id="export-dialog-description" sx={{ mb: 2 }}>
            A kiválasztott {selectedEmployees.length} kollégához elkészítjük a jelenléti íveket, és egy ZIP-ben letöltjük.
          </DialogContentText>

          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <TextField
              label="Év"
              type="number"
              value={exportYear}
              onChange={e => setExportYear(Number(e.target.value))}
              inputProps={{ min: 2000, max: 2100 }}
              fullWidth
              disabled={isExporting}
            />
            <TextField
              label="Hónap"
              select
              value={exportMonth}
              onChange={e => setExportMonth(Number(e.target.value))}
              fullWidth
              disabled={isExporting}
            >
              {[
                { value: 1, label: 'Január' },
                { value: 2, label: 'Február' },
                { value: 3, label: 'Március' },
                { value: 4, label: 'Április' },
                { value: 5, label: 'Május' },
                { value: 6, label: 'Június' },
                { value: 7, label: 'Július' },
                { value: 8, label: 'Augusztus' },
                { value: 9, label: 'Szeptember' },
                { value: 10, label: 'Október' },
                { value: 11, label: 'November' },
                { value: 12, label: 'December' }
              ].map(m => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportCancel} disabled={isExporting}>
            Mégse
          </Button>
          <Button onClick={handleExportConfirm} variant="contained" disabled={isExporting}>
            {isExporting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                Generálás...
              </Box>
            ) : (
              'Letöltés'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Official PDF Export Dialog */}
      <Dialog
        open={exportOfficialDialogOpen}
        onClose={handleExportOfficialCancel}
        aria-labelledby="export-official-dialog-title"
        aria-describedby="export-official-dialog-description"
      >
        <DialogTitle id="export-official-dialog-title">PDF export</DialogTitle>
        <DialogContent>
          <DialogContentText id="export-official-dialog-description" sx={{ mb: 2 }}>
            A kiválasztott {selectedEmployees.length} kollégához elkészítjük a hivatalos jelenléti íveket, és egy ZIP-ben letöltjük.
          </DialogContentText>

          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <TextField
              label="Év"
              type="number"
              value={exportYear}
              onChange={e => setExportYear(Number(e.target.value))}
              inputProps={{ min: 2000, max: 2100 }}
              fullWidth
              disabled={isExportingOfficial}
            />
            <TextField
              label="Hónap"
              select
              value={exportMonth}
              onChange={e => setExportMonth(Number(e.target.value))}
              fullWidth
              disabled={isExportingOfficial}
            >
              {[
                { value: 1, label: 'Január' },
                { value: 2, label: 'Február' },
                { value: 3, label: 'Március' },
                { value: 4, label: 'Április' },
                { value: 5, label: 'Május' },
                { value: 6, label: 'Június' },
                { value: 7, label: 'Július' },
                { value: 8, label: 'Augusztus' },
                { value: 9, label: 'Szeptember' },
                { value: 10, label: 'Október' },
                { value: 11, label: 'November' },
                { value: 12, label: 'December' }
              ].map(m => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportOfficialCancel} disabled={isExportingOfficial}>
            Mégse
          </Button>
          <Button onClick={handleExportOfficialConfirm} variant="contained" disabled={isExportingOfficial}>
            {isExportingOfficial ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                Generálás...
              </Box>
            ) : (
              'Letöltés'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

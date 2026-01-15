'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Box,
  Typography,
  Breadcrumbs,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import { Home as HomeIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Holiday {
  id: string
  name: string
  start_date: string
  end_date: string
  type: 'national' | 'company'
  active: boolean
  created_at: string
  updated_at: string
}

interface HolidaysListProps {
  initialHolidays: Holiday[]
}

export default function HolidaysList({ initialHolidays }: HolidaysListProps) {
  const router = useRouter()
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRowClick = (holidayId: string) => {
    router.push(`/holidays/${holidayId}`)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedHolidays(holidays.map(holiday => holiday.id))
    } else {
      setSelectedHolidays([])
    }
  }

  const handleSelectHoliday = (holidayId: string) => {
    setSelectedHolidays(prev => 
      prev.includes(holidayId) 
        ? prev.filter(id => id !== holidayId)
        : [...prev, holidayId]
    )
  }

  const isAllSelected = selectedHolidays.length === holidays.length && holidays.length > 0
  const isIndeterminate = selectedHolidays.length > 0 && selectedHolidays.length < holidays.length

  const handleDeleteClick = () => {
    if (selectedHolidays.length === 0) return
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (selectedHolidays.length === 0) return

    setIsDeleting(true)
    try {
      // Delete all selected holidays
      const deletePromises = selectedHolidays.map(id =>
        fetch(`/api/holidays/${id}`, { method: 'DELETE' })
      )

      const results = await Promise.allSettled(deletePromises)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
      const failed = results.length - successful

      if (successful > 0) {
        toast.success(`${successful} ünnep sikeresen törölve!`, {
          position: "top-right",
          autoClose: 3000
        })

        // Remove from local state
        setHolidays(prev => prev.filter(h => !selectedHolidays.includes(h.id)))
        setSelectedHolidays([])
        
        // Invalidate cache
        invalidateApiCache('/api/holidays')
      }

      if (failed > 0) {
        toast.error(`${failed} ünnep törlése sikertelen!`, {
          position: "top-right",
          autoClose: 5000
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(`Hiba történt a törlés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const getTypeLabel = (type: string) => {
    return type === 'national' ? 'Nemzeti' : 'Céges'
  }

  const getTypeColor = (type: string) => {
    return type === 'national' ? 'primary' : 'secondary'
  }

  return (
    <Box sx={{ p: 3 }}>
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
          Ünnepek
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Ünnepek
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedHolidays.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              color="error"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              Törlés ({selectedHolidays.length})
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            href="/holidays/new"
            sx={{
              backgroundColor: '#000000',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#333333',
              }
            }}
          >
            Új ünnep hozzáadása
          </Button>
        </Box>
      </Box>

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
              <TableCell sx={{ fontWeight: 600 }}>Név</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Kezdő dátum</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Vég dátum</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Típus</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Aktív</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nincs ünnep
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((holiday) => (
                <TableRow 
                  key={holiday.id} 
                  hover
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                  onClick={() => handleRowClick(holiday.id)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedHolidays.includes(holiday.id)}
                      onChange={() => handleSelectHoliday(holiday.id)}
                    />
                  </TableCell>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>{formatDate(holiday.start_date)}</TableCell>
                  <TableCell>{formatDate(holiday.end_date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getTypeLabel(holiday.type)}
                      color={getTypeColor(holiday.type)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={holiday.active ? 'Aktív' : 'Inaktív'}
                      color={holiday.active ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Ünnepek törlése
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Biztosan törölni szeretné a kiválasztott {selectedHolidays.length} ünnepet? Ez a művelet nem vonható vissza.
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

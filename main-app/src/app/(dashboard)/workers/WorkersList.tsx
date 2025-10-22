'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Button, 
  TextField, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableContainer, 
  Paper,
  InputAdornment,
  Box as MuiBox
} from '@mui/material'
import { Home as HomeIcon, Add as AddIcon, Search as SearchIcon } from '@mui/icons-material'

interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

interface WorkersListProps {
  initialWorkers: Worker[]
}

// Phone number formatting helper
const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return ''
  
  const digits = phone.replace(/\D/g, '')
  
  let formatted = digits
  if (!digits.startsWith('36') && digits.length > 0) {
    formatted = '36' + digits
  }
  
  if (formatted.length >= 2) {
    const countryCode = formatted.substring(0, 2)
    const areaCode = formatted.substring(2, 4)
    const firstPart = formatted.substring(4, 7)
    const secondPart = formatted.substring(7, 11)
    
    let result = `+${countryCode}`
    if (areaCode) result += ` ${areaCode}`
    if (firstPart) result += ` ${firstPart}`
    if (secondPart) result += ` ${secondPart}`
    
    return result
  }
  
  return phone
}

export default function WorkersList({ initialWorkers }: WorkersListProps) {
  const router = useRouter()

  const handleRowClick = (workerId: string) => {
    router.push(`/workers/${workerId}`)
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
          Dolgozók
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Dolgozók
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={Link}
          href="/workers/new"
          sx={{ 
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0'
            }
          }}
        >
          Új dolgozó hozzáadása
        </Button>
      </Box>
      
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Keresés név vagy becenév szerint..."
        sx={{ mt: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      {/* Workers Table */}
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Név</TableCell>
              <TableCell>Becenév</TableCell>
              <TableCell>Telefon</TableCell>
              <TableCell>Szín</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {initialWorkers.map((worker) => (
              <TableRow 
                key={worker.id} 
                hover 
                sx={{ 
                  cursor: 'pointer',
                  backgroundColor: worker.color ? `${worker.color}10` : 'transparent',
                  '&:hover': {
                    backgroundColor: worker.color ? `${worker.color}20` : 'action.hover'
                  }
                }}
                onClick={() => handleRowClick(worker.id)}
              >
                <TableCell>{worker.name}</TableCell>
                <TableCell>{worker.nickname || '-'}</TableCell>
                <TableCell>{formatPhoneNumber(worker.mobile)}</TableCell>
                <TableCell>
                  <MuiBox
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: worker.color || '#1976d2',
                      borderRadius: '50%',
                      border: '1px solid #ccc',
                      display: 'inline-block'
                    }}
                    title={worker.color || '#1976d2'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Empty State */}
      {initialWorkers.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Nincs dolgozó
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Kezdje el az első dolgozó hozzáadásával
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={Link}
            href="/workers/new"
            sx={{ 
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              }
            }}
          >
            Új dolgozó hozzáadása
          </Button>
        </Box>
      )}
    </Box>
  )
}

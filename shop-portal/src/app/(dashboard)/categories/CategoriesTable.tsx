'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  TextField,
  InputAdornment,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Link as MuiLink
} from '@mui/material'
import {
  Search as SearchIcon,
  Sync as SyncIcon,
  Edit as EditIcon,
  Category as CategoryIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

interface Category {
  id: string
  name: string | null
  shoprenter_id: string
  status: number
  sync_status: string
  category_url: string | null
  last_synced_at: string | null
  parent_category_id: string | null
  shoprenter_category_descriptions?: Array<{
    name: string
    language_id: string
  }>
}

interface Connection {
  id: string
  name: string
  connection_type: string
}

interface CategoriesTableProps {
  initialCategories: Category[]
  connections: Connection[]
  initialConnectionId: string
  initialSearch: string
}

export default function CategoriesTable({
  initialCategories,
  connections,
  initialConnectionId,
  initialSearch
}: CategoriesTableProps) {
  const router = useRouter()
  const [categories] = useState<Category[]>(initialCategories)
  const [selectedConnectionId, setSelectedConnectionId] = useState(initialConnectionId)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)

  // Filter categories based on search term
  const filteredCategories = categories.filter(cat => {
    const name = cat.name || cat.shoprenter_category_descriptions?.[0]?.name || ''
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           cat.shoprenter_id.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Handle sync categories
  const handleSyncCategories = async (connectionId: string) => {
    try {
      setSyncingConnectionId(connectionId)
      
      const response = await fetch(`/api/connections/${connectionId}/sync-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Kategória szinkronizálás sikertelen')
      }

      toast.success('Kategória szinkronizálás elindítva')
      
      // Poll for progress
      const pollProgress = async () => {
        const progressResponse = await fetch(`/api/connections/${connectionId}/sync-categories`)
        if (progressResponse.ok) {
          const data = await progressResponse.json()
          if (data.progress) {
            if (data.progress.status === 'completed') {
              setSyncingConnectionId(null)
              toast.success(`Kategóriák szinkronizálása befejeződött: ${data.progress.synced} kategória`)
              router.refresh()
            } else if (data.progress.status === 'error') {
              setSyncingConnectionId(null)
              toast.error('Kategória szinkronizálás hiba történt')
            } else {
              // Continue polling
              setTimeout(pollProgress, 2000)
            }
          }
        }
      }
      
      setTimeout(pollProgress, 2000)

    } catch (error) {
      console.error('Error syncing categories:', error)
      toast.error(`Hiba a kategóriák szinkronizálásakor: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
      setSyncingConnectionId(null)
    }
  }

  // Handle connection change
  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnectionId(connectionId)
    router.push(`/categories?connectionId=${connectionId}&search=${encodeURIComponent(searchTerm)}`)
  }

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    router.push(`/categories?connectionId=${selectedConnectionId}&search=${encodeURIComponent(value)}`)
  }

  const shoprenterConnections = connections.filter(c => c.connection_type === 'shoprenter')

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Kategóriák kezelése
        </Typography>
        {shoprenterConnections.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Kapcsolat</InputLabel>
              <Select
                value={selectedConnectionId}
                label="Kapcsolat"
                onChange={(e) => handleConnectionChange(e.target.value)}
              >
                {shoprenterConnections.map(conn => (
                  <MenuItem key={conn.id} value={conn.id}>
                    {conn.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SyncIcon />}
              onClick={() => handleSyncCategories(selectedConnectionId)}
              disabled={syncingConnectionId === selectedConnectionId}
              color="primary"
            >
              {syncingConnectionId === selectedConnectionId ? 'Szinkronizálás...' : 'Kategóriák szinkronizálása'}
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés kategória neve vagy ID szerint..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Név</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Szinkronizálás</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Utolsó szinkronizálás</TableCell>
              <TableCell>Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CategoryIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="body1" color="text.secondary">
                      {categories.length === 0 
                        ? 'Nincs szinkronizált kategória. Kattintson a "Kategóriák szinkronizálása" gombra.'
                        : 'Nincs találat a keresésre'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => {
                const categoryName = category.name || 
                                   category.shoprenter_category_descriptions?.[0]?.name || 
                                   'Névtelen kategória'
                
                return (
                  <TableRow key={category.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {categoryName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category.status === 1 ? 'Aktív' : 'Inaktív'}
                        size="small"
                        color={category.status === 1 ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={category.sync_status || 'pending'}
                        size="small"
                        color={
                          category.sync_status === 'synced' ? 'success' :
                          category.sync_status === 'error' ? 'error' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {category.category_url ? (
                        <MuiLink
                          href={category.category_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        >
                          {category.category_url}
                        </MuiLink>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Nincs URL
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {category.last_synced_at ? (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(category.last_synced_at).toLocaleString('hu-HU')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Még nem szinkronizálva
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Kategória szerkesztése">
                        <IconButton
                          size="small"
                          component={NextLink}
                          href={`/categories/${category.id}`}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

'use client'

import React, { useState, useTransition } from 'react'
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
  CircularProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Sync as SyncIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import type { ShopRenterProduct } from '@/lib/products-server'

interface ProductsTableProps {
  initialProducts: ShopRenterProduct[]
}

export default function ProductsTable({ initialProducts }: ProductsTableProps) {
  const router = useRouter()
  const [products] = useState<ShopRenterProduct[]>(initialProducts)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncingProductId, setSyncingProductId] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Get status chip
  const getStatusChip = (product: ShopRenterProduct) => {
    if (product.status === 1) {
      return (
        <Chip 
          label="Aktív" 
          size="small" 
          color="success"
          icon={<CheckCircleIcon />}
        />
      )
    }
    return (
      <Chip 
        label="Inaktív" 
        size="small" 
        color="error"
        icon={<CancelIcon />}
      />
    )
  }

  // Get sync status chip
  const getSyncStatusChip = (product: ShopRenterProduct) => {
    if (product.sync_status === 'synced') {
      return (
        <Chip 
          label="Szinkronizálva" 
          size="small" 
          color="success"
        />
      )
    }
    if (product.sync_status === 'error') {
      return (
        <Chip 
          label="Hiba" 
          size="small" 
          color="error"
        />
      )
    }
    return (
      <Chip 
        label="Függőben" 
        size="small" 
        color="warning"
      />
    )
  }

  // Handle product click - navigate to edit page
  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  // Handle sync product
  const handleSyncProduct = async (productId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    try {
      setSyncingProductId(productId)
      
      const response = await fetch(`/api/products/${productId}/sync`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Termék sikeresen szinkronizálva!')
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(`Szinkronizálás sikertelen: ${result.error || 'Ismeretlen hiba'}`)
      }
    } catch (error) {
      console.error('Error syncing product:', error)
      toast.error('Hiba a termék szinkronizálásakor')
    } finally {
      setSyncingProductId(null)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Termékek
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés SKU vagy név alapján..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Products Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Név</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Szinkronizálás</TableCell>
              <TableCell>Utolsó szinkronizálás</TableCell>
              <TableCell align="right">Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'Nincs találat' : 'Nincsenek termékek'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow
                  key={product.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProductClick(product.id)}
                >
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.name || '-'}</TableCell>
                  <TableCell>{getStatusChip(product)}</TableCell>
                  <TableCell>{getSyncStatusChip(product)}</TableCell>
                  <TableCell>
                    {product.last_synced_at 
                      ? new Date(product.last_synced_at).toLocaleString('hu-HU')
                      : '-'
                    }
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Szinkronizálás">
                      <IconButton
                        size="small"
                        onClick={(e) => handleSyncProduct(product.id, e)}
                        disabled={syncingProductId === product.id}
                      >
                        {syncingProductId === product.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <SyncIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Szerkesztés">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleProductClick(product.id)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material'
import { FamilyRestroom as FamilyRestroomIcon } from '@mui/icons-material'

interface Step3ProductRelationshipProps {
  connectionId: string | null
  selectedParentId: string | null
  onSelect: (parentId: string | null) => void
}

interface ProductOption {
  id: string
  sku: string
  name: string
}

export default function Step3ProductRelationship({
  connectionId,
  selectedParentId,
  onSelect
}: Step3ProductRelationshipProps) {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

  // Load products when connection is selected
  useEffect(() => {
    if (connectionId) {
      loadProducts()
    } else {
      setProducts([])
    }
  }, [connectionId])

  // Load selected product if parent_product_id is set
  useEffect(() => {
    if (selectedParentId && products.length > 0) {
      const product = products.find(p => p.id === selectedParentId)
      if (product) {
        setSelectedProduct(product)
      }
    }
  }, [selectedParentId, products])

  const loadProducts = async () => {
    if (!connectionId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/products/search?connection_id=${connectionId}&limit=1000`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const productOptions: ProductOption[] = (data.products || []).map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name || p.sku
          }))
          setProducts(productOptions)
        }
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductChange = (product: ProductOption | null) => {
    setSelectedProduct(product)
    onSelect(product?.id || null)
  }

  const filteredProducts = products.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#ff9800',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#ff9800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
        }}>
          <FamilyRestroomIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#f57c00' }}>
          Termék kapcsolata
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ha ez a termék egy variáns (pl. különböző méret vagy szín), válassza ki a szülő terméket. 
        Ha ez egy önálló termék, hagyja üresen.
      </Typography>

      <Autocomplete
        options={filteredProducts}
        value={selectedProduct}
        onChange={(_, newValue) => handleProductChange(newValue)}
        onInputChange={(_, newInputValue) => setSearchTerm(newInputValue)}
        loading={loading}
        getOptionLabel={(option) => `${option.sku} - ${option.name}`}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Szülő termék (opcionális)"
            placeholder="Keresés SKU vagy név alapján..."
            helperText="Hagyja üresen, ha ez egy önálló termék"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)'
                },
                '&.Mui-focused': {
                  bgcolor: 'white'
                }
              }
            }}
          />
        )}
        noOptionsText="Nincs találat"
        clearOnEscape
      />

      {selectedProduct && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Kiválasztott szülő termék: <strong>{selectedProduct.sku}</strong> - {selectedProduct.name}
        </Alert>
      )}
    </Paper>
  )
}

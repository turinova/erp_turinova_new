'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Checkbox,
  ListItemText,
  Paper
} from '@mui/material'
import { Category as CategoryIcon } from '@mui/icons-material'

interface Step4CategoriesProps {
  connectionId: string | null
  selectedCategoryIds: string[]
  onSelect: (categoryIds: string[]) => void
}

interface Category {
  id: string
  name: string
  path: string
}

export default function Step4Categories({
  connectionId,
  selectedCategoryIds,
  onSelect
}: Step4CategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (connectionId) {
      loadCategories()
    } else {
      setCategories([])
    }
  }, [connectionId])

  const loadCategories = async () => {
    if (!connectionId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/categories?connection_id=${connectionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCategories(data.categories || [])
        } else {
          setError(data.error || 'Hiba a kategóriák betöltésekor')
        }
      } else {
        setError('Hiba a kategóriák betöltésekor')
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      setError('Hiba a kategóriák betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    )
  }

  if (categories.length === 0) {
    return (
      <Alert severity="warning">
        Nincs elérhető kategória ezen a kapcsolaton. Kérjük, szinkronizálja a kategóriákat először.
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
        borderColor: '#4caf50',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#4caf50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
        }}>
          <CategoryIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
          Kategóriák
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Válassza ki, hogy a termék melyik kategóriákba tartozik. Legalább egy kategória kötelező.
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Kategóriák *</InputLabel>
        <Select
          multiple
          value={selectedCategoryIds}
          onChange={(e) => onSelect(e.target.value as string[])}
          label="Kategóriák *"
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.02)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.04)'
            },
            '&.Mui-focused': {
              bgcolor: 'white'
            }
          }}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((categoryId) => {
                const category = categories.find(c => c.id === categoryId)
                return (
                  <Chip
                    key={categoryId}
                    label={category?.path || category?.name || 'Ismeretlen'}
                    size="small"
                  />
                )
              })}
            </Box>
          )}
        >
          {categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              <Checkbox checked={selectedCategoryIds.indexOf(category.id) > -1} />
              <ListItemText primary={category.path || category.name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedCategoryIds.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Kiválasztott kategóriák:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedCategoryIds.map((categoryId) => {
              const category = categories.find(c => c.id === categoryId)
              return (
                <Chip
                  key={categoryId}
                  label={category?.path || category?.name || 'Ismeretlen'}
                  color="primary"
                  size="small"
                  onDelete={() => onSelect(selectedCategoryIds.filter(id => id !== categoryId))}
                />
              )
            })}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

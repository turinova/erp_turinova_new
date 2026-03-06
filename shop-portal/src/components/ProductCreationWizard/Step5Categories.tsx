'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Chip
} from '@mui/material'
import { Category as CategoryIcon, Add as AddIcon, Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material'

interface Step5CategoriesProps {
  connectionId: string | null
  selectedCategoryIds: string[]
  onSelect: (categoryIds: string[]) => void
}

interface Category {
  id: string
  name: string
  path?: string
  displayName?: string
  level?: number
}

export default function Step5Categories({
  connectionId,
  selectedCategoryIds,
  onSelect
}: Step5CategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (connectionId) {
      loadCategories()
    } else {
      setCategories([])
    }
  }, [connectionId])

  useEffect(() => {
    // Load selected categories details
    if (selectedCategoryIds.length > 0 && connectionId) {
      loadSelectedCategories()
    } else {
      setCategories([])
    }
  }, [selectedCategoryIds, connectionId])

  const loadCategories = async () => {
    if (!connectionId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/categories?connection_id=${connectionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // This loads all categories, we'll filter in modal
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

  const loadSelectedCategories = async () => {
    if (!connectionId) return

    try {
      const response = await fetch(`/api/categories?connection_id=${connectionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const selected = (data.categories || []).filter((cat: Category) =>
            selectedCategoryIds.includes(cat.id)
          )
          setCategories(selected)
        }
      }
    } catch (error) {
      console.error('Error loading selected categories:', error)
    }
  }

  const loadAvailableCategories = async () => {
    if (!connectionId) return

    setLoadingAvailable(true)
    try {
      const response = await fetch(`/api/connections/${connectionId}/categories`)
      if (response.ok) {
        const data = await response.json()
        if (data.categories) {
          // Filter out already selected categories
          const filtered = (data.categories || []).filter(
            (cat: Category) => !selectedCategoryIds.includes(cat.id)
          )
          setAvailableCategories(filtered)
        }
      }
    } catch (error) {
      console.error('Error loading available categories:', error)
    } finally {
      setLoadingAvailable(false)
    }
  }

  const handleOpenModal = () => {
    setModalOpen(true)
    setSelectedIds([...selectedCategoryIds])
    setSearchTerm('')
    loadAvailableCategories()
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedIds([...selectedCategoryIds])
    setSearchTerm('')
  }

  const handleSave = () => {
    onSelect(selectedIds)
    setModalOpen(false)
  }

  const handleToggleCategory = (categoryId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId)
      } else {
        return [...prev, categoryId]
      }
    })
  }

  const handleDeleteCategory = (categoryId: string) => {
    onSelect(selectedCategoryIds.filter(id => id !== categoryId))
  }

  const filteredAvailableCategories = availableCategories.filter((cat: Category) => {
    const displayName = cat.displayName || cat.name || ''
    const path = cat.path || ''
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         path.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

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

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
          border: '2px solid',
          borderColor: '#ff9800',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(255, 152, 0, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(30px, -30px)'
          }
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
            <CategoryIcon sx={{ color: 'white', fontSize: '24px' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
            Kategóriák
          </Typography>
          <Chip
            label={selectedCategoryIds.length}
            size="small"
            sx={{
              bgcolor: '#ff9800',
              color: 'white',
              fontWeight: 600,
              height: '24px'
            }}
          />
        </Box>

        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          position: 'relative',
          zIndex: 1,
          mb: 2
        }}>
          {categories.map((category) => {
            const displayName = category.displayName || category.path || category.name || 'Ismeretlen'
            return (
              <Chip
                key={category.id}
                label={displayName}
                size="small"
                onDelete={() => handleDeleteCategory(category.id)}
                deleteIcon={<CloseIcon fontSize="small" />}
                sx={{
                  height: '36px',
                  bgcolor: 'white',
                  border: '1px solid',
                  borderColor: '#ff9800',
                  color: '#e65100',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: '#fff3e0',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(255, 152, 0, 0.2)',
                    transition: 'all 0.2s ease',
                    '& .MuiChip-deleteIcon': {
                      opacity: 1
                    }
                  },
                  '& .MuiChip-deleteIcon': {
                    color: '#e65100',
                    fontSize: '16px',
                    opacity: 0.7,
                    '&:hover': {
                      color: '#bf360c',
                      bgcolor: '#fff3e0',
                      borderRadius: '50%'
                    },
                    transition: 'all 0.2s ease'
                  },
                  transition: 'all 0.2s ease'
                }}
              />
            )
          })}
          {categories.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', width: '100%' }}>
              Nincs hozzárendelt kategória
            </Typography>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={handleOpenModal}
            sx={{
              height: '36px',
              borderColor: '#ff9800',
              color: '#e65100',
              fontSize: '0.875rem',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#f57c00',
                bgcolor: '#fff3e0'
              },
              transition: 'all 0.2s ease'
            }}
          >
            Kategória hozzáadása
          </Button>
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', position: 'relative', zIndex: 1 }}>
          Legalább egy kategória kötelező. A termék több kategóriába is tartozhat.
        </Typography>
      </Paper>

      {/* Add Category Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#ff9800'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#fff3e0',
          borderBottom: '1px solid',
          borderColor: '#ffb74d',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <CategoryIcon sx={{ color: '#ff9800' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#e65100', fontSize: '1.25rem' }}>
            Kategória hozzáadása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            placeholder="Keresés kategóriák között..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#ff9800' }} />
                </InputAdornment>
              ),
            }}
          />

          {loadingAvailable ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#ff9800' }} />
            </Box>
          ) : filteredAvailableCategories.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: '#fff3e0', border: '1px solid', borderColor: '#ffb74d' }}>
              {searchTerm
                ? 'Nincs találat a keresésre.'
                : 'Nincs elérhető kategória, vagy minden kategória már hozzá van rendelve.'}
            </Alert>
          ) : (
            <Box sx={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: '#ffb74d',
              borderRadius: 1,
              bgcolor: '#fffbf5'
            }}>
              <List dense>
                {filteredAvailableCategories.map((category: Category) => {
                  const displayName = category.displayName || category.name || 'Kategória'
                  const isSelected = selectedIds.includes(category.id)
                  const indent = category.level || 0

                  return (
                    <ListItem
                      key={category.id}
                      disablePadding
                      sx={{
                        pl: `${1 + indent * 2}rem`,
                        '&:hover': {
                          bgcolor: '#fff3e0'
                        }
                      }}
                    >
                      <ListItemButton
                        onClick={() => handleToggleCategory(category.id)}
                        sx={{
                          py: 0.5,
                          borderRadius: 1
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          sx={{
                            color: '#ff9800',
                            '&.Mui-checked': {
                              color: '#e65100'
                            }
                          }}
                        />
                        <ListItemText
                          primary={displayName}
                          secondary={category.path && category.path !== displayName ? category.path : undefined}
                          primaryTypographyProps={{
                            sx: {
                              fontSize: '0.875rem',
                              fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? '#e65100' : 'text.primary'
                            }
                          }}
                          secondaryTypographyProps={{
                            sx: {
                              fontSize: '0.75rem',
                              color: 'text.secondary'
                            }
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleCloseModal}>
            Mégse
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={selectedIds.length === 0}
            sx={{
              bgcolor: '#ff9800',
              color: 'white',
              '&:hover': {
                bgcolor: '#f57c00'
              },
              '&.Mui-disabled': {
                bgcolor: '#ffcc80',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={<AddIcon />}
          >
            Hozzáadás ({selectedIds.length})
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

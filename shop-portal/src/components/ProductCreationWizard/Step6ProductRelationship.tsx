'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip
} from '@mui/material'
import { FamilyRestroom as FamilyRestroomIcon, Add as AddIcon, Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material'

interface Step6ProductRelationshipProps {
  connectionId: string | null
  selectedParentId: string | null
  onSelect: (parentId: string | null) => void
}

interface Product {
  id: string
  sku: string
  name: string
  model_number?: string | null
}

export default function Step6ProductRelationship({
  connectionId,
  selectedParentId,
  onSelect
}: Step6ProductRelationshipProps) {
  const [parentProduct, setParentProduct] = useState<Product | null>(null)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Debounce search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (connectionId && selectedParentId) {
      loadParentProduct()
    } else {
      setParentProduct(null)
    }
  }, [connectionId, selectedParentId])

  useEffect(() => {
    if (modalOpen && connectionId) {
      loadAvailableProducts(debouncedSearchTerm)
    }
  }, [modalOpen, connectionId, debouncedSearchTerm])

  const loadParentProduct = async () => {
    if (!connectionId || !selectedParentId) return

    setLoading(true)
    try {
      // Try to find the product in available products first, or fetch it
      const response = await fetch(`/api/connections/${connectionId}/products`)
      if (response.ok) {
        const data = await response.json()
        const products = data.products || []
        const found = products.find((p: Product) => p.id === selectedParentId)
        if (found) {
          setParentProduct(found)
        } else {
          // If not found, try to get it from the database directly
          // For now, just set a basic object
          setParentProduct({
            id: selectedParentId,
            sku: '...',
            name: 'Betöltés...'
          })
        }
      }
    } catch (error) {
      console.error('Error loading parent product:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableProducts = async (search: string = '') => {
    if (!connectionId) return

    setLoadingAvailable(true)
    try {
      const url = `/api/connections/${connectionId}/products${search ? `?search=${encodeURIComponent(search)}` : ''}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        // API returns { products: [...] } directly
        const products = data.products || []
        // Filter out products that already have a parent (children can't be parents)
        // The API should already filter this, but we'll double-check
        setAvailableProducts(products.filter((p: Product) => p.id !== selectedParentId))
      }
    } catch (error) {
      console.error('Error loading available products:', error)
    } finally {
      setLoadingAvailable(false)
    }
  }

  const handleOpenModal = () => {
    setModalOpen(true)
    setSelectedId(selectedParentId)
    setSearchTerm('')
    loadAvailableProducts()
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedId(selectedParentId)
    setSearchTerm('')
  }

  const handleSave = () => {
    onSelect(selectedId)
    setModalOpen(false)
  }

  const handleRemove = () => {
    onSelect(null)
    setParentProduct(null)
    setModalOpen(false)
  }

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
          border: '2px solid',
          borderColor: '#9c27b0',
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
            background: 'radial-gradient(circle, rgba(156, 39, 176, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(30px, -30px)'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            p: 1,
            borderRadius: '50%',
            bgcolor: '#9c27b0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
          }}>
            <FamilyRestroomIcon sx={{ color: 'white', fontSize: '24px' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
            Termék kapcsolata
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Betöltés...
              </Typography>
            </Box>
          ) : parentProduct ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              bgcolor: 'white',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: '#ce93d8',
              boxShadow: '0 2px 8px rgba(156, 39, 176, 0.1)',
              mb: 2
            }}>
              <Chip
                label={parentProduct.sku}
                size="small"
                sx={{
                  height: '24px',
                  fontSize: '0.75rem',
                  bgcolor: '#f3e5f5',
                  color: '#7b1fa2',
                  fontWeight: 600
                }}
              />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: '#7b1fa2' }}>
                {parentProduct.name}
              </Typography>
              <Button
                startIcon={<CloseIcon />}
                variant="outlined"
                size="small"
                onClick={handleRemove}
                sx={{
                  height: '32px',
                  borderColor: '#9c27b0',
                  color: '#7b1fa2',
                  fontSize: '0.75rem',
                  '&:hover': {
                    borderColor: '#7b1fa2',
                    bgcolor: '#f3e5f5'
                  }
                }}
              >
                Eltávolítás
              </Button>
            </Box>
          ) : (
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              onClick={handleOpenModal}
              sx={{
                height: '36px',
                borderColor: '#9c27b0',
                color: '#7b1fa2',
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#7b1fa2',
                  bgcolor: '#f3e5f5'
                },
                transition: 'all 0.2s ease'
              }}
            >
              Szülő termék hozzáadása
            </Button>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            Ha ez a termék egy variáns (pl. különböző méret vagy szín), válassza ki a szülő terméket. Ha ez egy önálló termék, hagyja üresen.
          </Typography>
        </Box>
      </Paper>

      {/* Parent Product Selection Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#9c27b0'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#f3e5f5',
          borderBottom: '1px solid',
          borderColor: '#ce93d8',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <FamilyRestroomIcon sx={{ color: '#9c27b0' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#7b1fa2', fontSize: '1.25rem' }}>
            Szülő termék hozzáadása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            placeholder="Keresés termékek között (név, SKU)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9c27b0' }} />
                </InputAdornment>
              ),
            }}
          />

          {loadingAvailable ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#9c27b0' }} />
            </Box>
          ) : (
            <>
              {availableProducts.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: '#f3e5f5', border: '1px solid', borderColor: '#ce93d8' }}>
                  {searchTerm
                    ? 'Nincs találat a keresésre.'
                    : 'Nincs elérhető termék. (Csak olyan termékek jelennek meg, amelyeknek nincs szülő terméke.)'}
                </Alert>
              ) : (
                <Box sx={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: '#ce93d8',
                  borderRadius: 1,
                  bgcolor: '#fafafa'
                }}>
                  <RadioGroup
                    value={selectedId || ''}
                    onChange={(e) => setSelectedId(e.target.value || null)}
                  >
                    <List dense>
                      {availableProducts.map((prod: Product) => {
                        const isSelected = selectedId === prod.id

                        return (
                          <ListItem
                            key={prod.id}
                            disablePadding
                            sx={{
                              '&:hover': {
                                bgcolor: '#f3e5f5'
                              }
                            }}
                          >
                            <ListItemButton
                              onClick={() => setSelectedId(prod.id)}
                              sx={{
                                py: 0.5,
                                borderRadius: 1
                              }}
                            >
                              <FormControlLabel
                                value={prod.id}
                                control={
                                  <Radio
                                    sx={{
                                      color: '#9c27b0',
                                      '&.Mui-checked': {
                                        color: '#7b1fa2'
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <ListItemText
                                    primary={prod.name}
                                    secondary={`SKU: ${prod.sku}${prod.model_number ? ` | Modell: ${prod.model_number}` : ''}`}
                                    primaryTypographyProps={{
                                      sx: {
                                        fontSize: '0.875rem',
                                        fontWeight: isSelected ? 600 : 400,
                                        color: isSelected ? '#7b1fa2' : 'text.primary'
                                      }
                                    }}
                                    secondaryTypographyProps={{
                                      sx: {
                                        fontSize: '0.75rem',
                                        color: 'text.secondary'
                                      }
                                    }}
                                  />
                                }
                                sx={{ m: 0, width: '100%' }}
                              />
                            </ListItemButton>
                          </ListItem>
                        )
                      })}
                    </List>
                  </RadioGroup>
                </Box>
              )}
            </>
          )}

          {selectedId && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid', borderColor: '#ce93d8' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#7b1fa2' }}>
                Kiválasztva: {availableProducts.find((p: Product) => p.id === selectedId)?.name || 'Ismeretlen'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{
          bgcolor: '#fafafa',
          borderTop: '1px solid',
          borderColor: '#ce93d8',
          px: 2,
          py: 1.5
        }}>
          {selectedParentId && (
            <Button
              onClick={handleRemove}
              color="error"
              sx={{ mr: 'auto' }}
            >
              Eltávolítás
            </Button>
          )}
          <Button onClick={handleCloseModal}>
            Mégse
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!selectedId}
            sx={{
              bgcolor: '#9c27b0',
              color: 'white',
              '&:hover': {
                bgcolor: '#7b1fa2'
              },
              '&.Mui-disabled': {
                bgcolor: '#ce93d8',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
          >
            Mentés
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

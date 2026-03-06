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
  Radio,
  RadioGroup,
  FormControlLabel
} from '@mui/material'
import { LocalOffer as LocalOfferIcon, Add as AddIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material'

interface Step3ProductClassProps {
  connectionId: string | null
  selectedProductClassId: string | null
  onSelect: (productClassId: string | null) => void
}

interface ProductClass {
  id: string
  name: string
  description?: string | null
}

export default function Step3ProductClass({
  connectionId,
  selectedProductClassId,
  onSelect
}: Step3ProductClassProps) {
  const [productClasses, setProductClasses] = useState<ProductClass[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string>(selectedProductClassId || '')

  useEffect(() => {
    if (connectionId) {
      loadProductClasses()
    } else {
      setProductClasses([])
    }
  }, [connectionId])

  useEffect(() => {
    setSelectedId(selectedProductClassId || '')
  }, [selectedProductClassId])

  const loadProductClasses = async () => {
    if (!connectionId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/connections/${connectionId}/product-classes`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProductClasses(data.productClasses || [])
        } else {
          setError(data.error || 'Hiba a termék típusok betöltésekor')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Hiba a termék típusok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading product classes:', error)
      setError('Hiba a termék típusok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setModalOpen(true)
    setSelectedId(selectedProductClassId || '')
    setSearchTerm('')
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedId(selectedProductClassId || '')
    setSearchTerm('')
  }

  const handleSave = () => {
    onSelect(selectedId || null)
    setModalOpen(false)
  }

  const handleRemove = () => {
    onSelect(null)
    setModalOpen(false)
  }

  const filteredProductClasses = productClasses.filter(pc =>
    pc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pc.description && pc.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const selectedProductClass = productClasses.find(pc => pc.id === selectedProductClassId)

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
          background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
          border: '2px solid',
          borderColor: '#2196f3',
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
            background: 'radial-gradient(circle, rgba(33, 150, 243, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(30px, -30px)'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            p: 1,
            borderRadius: '50%',
            bgcolor: '#2196f3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
          }}>
            <LocalOfferIcon sx={{ color: 'white', fontSize: '24px' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
            Termék típusa
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {selectedProductClass ? (
            <Box sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 2
            }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'white',
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: '#90caf9',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.1)',
                  flex: 1,
                  minWidth: '200px'
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565c0', mb: 0.5 }}>
                  {selectedProductClass.name}
                </Typography>
                {selectedProductClass.description && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedProductClass.description}
                  </Typography>
                )}
              </Box>
              <Button
                startIcon={<EditIcon />}
                variant="outlined"
                size="small"
                onClick={handleOpenModal}
                sx={{
                  height: '40px',
                  borderColor: '#2196f3',
                  color: '#1565c0',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  '&:hover': {
                    borderColor: '#1976d2',
                    bgcolor: '#e3f2fd'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                Módosítás
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
                borderColor: '#2196f3',
                color: '#1565c0',
                fontSize: '0.875rem',
                fontWeight: 500,
                '&:hover': {
                  borderColor: '#1976d2',
                  bgcolor: '#e3f2fd'
                },
                transition: 'all 0.2s ease'
              }}
            >
              Termék típus hozzáadása
            </Button>
          )}
          {selectedProductClass && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              A termék típusa meghatározza, hogy mely attribútumok érhetők el a termékhez.
            </Typography>
          )}
          {!selectedProductClass && productClasses.length === 0 && (
            <Alert severity="info" sx={{ mt: 2, bgcolor: 'white', border: '1px solid', borderColor: '#90caf9' }}>
              <Typography variant="body2">
                Nincs elérhető termék típus. Kérjük, szinkronizálja a termék típusokat a kapcsolatok oldalon.
              </Typography>
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Product Class Selection Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#2196f3'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#e3f2fd',
          borderBottom: '1px solid',
          borderColor: '#90caf9',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LocalOfferIcon sx={{ color: '#2196f3' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1.25rem' }}>
            Termék típus kiválasztása
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            placeholder="Keresés termék típusok között..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#2196f3' }} />
                </InputAdornment>
              ),
            }}
          />

          {filteredProductClasses.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: '#e3f2fd', border: '1px solid', borderColor: '#90caf9' }}>
              {searchTerm
                ? 'Nincs találat a keresésre.'
                : 'Nincs elérhető termék típus.'}
            </Alert>
          ) : (
            <Box sx={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: '#90caf9',
              borderRadius: 1,
              bgcolor: '#f5f9ff'
            }}>
              <RadioGroup
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <List dense>
                  {filteredProductClasses.map((pc) => (
                    <ListItem
                      key={pc.id}
                      disablePadding
                      sx={{
                        '&:hover': {
                          bgcolor: '#e3f2fd'
                        }
                      }}
                    >
                      <ListItemButton
                        onClick={() => setSelectedId(pc.id)}
                        sx={{
                          py: 1,
                          borderRadius: 1
                        }}
                      >
                        <FormControlLabel
                          value={pc.id}
                          control={<Radio sx={{ color: '#2196f3', '&.Mui-checked': { color: '#1565c0' } }} />}
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                                {pc.name}
                              </Typography>
                              {pc.description && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  {pc.description}
                                </Typography>
                              )}
                            </Box>
                          }
                          sx={{ m: 0, flex: 1 }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </RadioGroup>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          {selectedProductClassId && (
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
              bgcolor: '#2196f3',
              color: 'white',
              '&:hover': {
                bgcolor: '#1976d2'
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

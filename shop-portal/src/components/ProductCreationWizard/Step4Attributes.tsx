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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip
} from '@mui/material'
import { Label as LabelIcon, Add as AddIcon, Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material'

interface Step4AttributesProps {
  connectionId: string | null
  productClassId: string | null
  attributes: any[] | null
  onChange: (attributes: any[]) => void
}

interface Attribute {
  id: string
  name: string
  type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
}

interface ListAttributeValue {
  id: string
  value: string
  displayValue: string
}

export default function Step4Attributes({
  connectionId,
  productClassId,
  attributes,
  onChange
}: Step4AttributesProps) {
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>('')
  const [newAttributeValue, setNewAttributeValue] = useState<any>(null)
  const [listAttributeValues, setListAttributeValues] = useState<ListAttributeValue[]>([])
  const [loadingListValues, setLoadingListValues] = useState(false)
  const [editAttributeIndex, setEditAttributeIndex] = useState<number | null>(null)

  const currentAttributes = Array.isArray(attributes) ? attributes : (attributes ? [attributes] : [])

  useEffect(() => {
    if (connectionId && productClassId) {
      loadAvailableAttributes()
    } else {
      setAvailableAttributes([])
    }
  }, [connectionId, productClassId])

  useEffect(() => {
    // Filter out already added attributes
    if (availableAttributes.length > 0 && currentAttributes.length > 0) {
      const addedIds = new Set(currentAttributes.map((attr: any) => attr.id || attr.attribute_shoprenter_id))
      setAvailableAttributes(prev => prev.filter(attr => !addedIds.has(attr.id)))
    }
  }, [currentAttributes])

  const loadAvailableAttributes = async () => {
    if (!connectionId || !productClassId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/products/new/attributes/available?connectionId=${connectionId}&productClassId=${productClassId}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Filter out already added attributes
          const addedIds = new Set(currentAttributes.map((attr: any) => attr.id || attr.attribute_shoprenter_id))
          setAvailableAttributes((data.attributes || []).filter((attr: Attribute) => !addedIds.has(attr.id)))
        } else {
          setError(data.error || 'Hiba az attribútumok betöltésekor')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Hiba az attribútumok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading attributes:', error)
      setError('Hiba az attribútumok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const loadListAttributeValues = async (attributeId: string) => {
    if (!connectionId) return

    setLoadingListValues(true)
    try {
      // For new products, we need to fetch list attribute values directly
      // We'll need to create an endpoint or use the connection's API directly
      const response = await fetch(`/api/connections/${connectionId}/list-attribute-values?attributeId=${attributeId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setListAttributeValues(data.values || [])
        }
      } else {
        // Fallback: try to get from ShopRenter API directly
        // This is a simplified approach - in production, create a proper endpoint
        console.warn('Could not fetch list attribute values')
        setListAttributeValues([])
      }
    } catch (error) {
      console.error('Error loading list attribute values:', error)
      setListAttributeValues([])
    } finally {
      setLoadingListValues(false)
    }
  }

  useEffect(() => {
    if (selectedAttributeId && addModalOpen) {
      const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId)
      if (selectedAttr?.type === 'LIST') {
        loadListAttributeValues(selectedAttributeId)
      } else {
        setListAttributeValues([])
      }
      setNewAttributeValue(null)
    }
  }, [selectedAttributeId, addModalOpen])

  const handleOpenAddModal = () => {
    setAddModalOpen(true)
    setSelectedAttributeId('')
    setNewAttributeValue(null)
    loadAvailableAttributes()
  }

  const handleCloseAddModal = () => {
    setAddModalOpen(false)
    setSelectedAttributeId('')
    setNewAttributeValue(null)
    setEditAttributeIndex(null)
  }

  const handleAddAttribute = () => {
    if (!selectedAttributeId || newAttributeValue === null || newAttributeValue === '') return

    const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId)
    if (!selectedAttr) return

    const newAttr = {
      id: selectedAttr.id,
      attribute_shoprenter_id: selectedAttr.id,
      name: selectedAttr.name,
      display_name: selectedAttr.name,
      type: selectedAttr.type,
      value: newAttributeValue,
      ...(selectedAttr.type === 'LIST' && { listAttributeValueId: newAttributeValue })
    }

    const updated = [...currentAttributes, newAttr]
    onChange(updated)
    handleCloseAddModal()
  }

  const handleDeleteAttribute = (index: number) => {
    const updated = currentAttributes.filter((_: any, i: number) => i !== index)
    onChange(updated.length > 0 ? updated : null)
  }

  const handleEditAttribute = (index: number) => {
    setEditAttributeIndex(index)
    const attr = currentAttributes[index]
    setSelectedAttributeId(attr.id || attr.attribute_shoprenter_id)
    setNewAttributeValue(attr.value || attr.listAttributeValueId)
    if (attr.type === 'LIST') {
      loadListAttributeValues(attr.id || attr.attribute_shoprenter_id)
    }
    setAddModalOpen(true)
  }

  const handleSaveEdit = () => {
    if (editAttributeIndex === null || !selectedAttributeId || newAttributeValue === null || newAttributeValue === '') return

    const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId) || 
                        currentAttributes.find((a: any) => (a.id || a.attribute_shoprenter_id) === selectedAttributeId)
    if (!selectedAttr) return

    const updated = [...currentAttributes]
    updated[editAttributeIndex] = {
      ...updated[editAttributeIndex],
      value: newAttributeValue,
      ...(selectedAttr.type === 'LIST' && { listAttributeValueId: newAttributeValue })
    }
    onChange(updated)
    handleCloseAddModal()
  }

  const selectedAttribute = availableAttributes.find(a => a.id === selectedAttributeId) ||
                           currentAttributes.find((a: any) => (a.id || a.attribute_shoprenter_id) === selectedAttributeId)

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  if (!productClassId) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
          border: '2px solid',
          borderColor: '#4caf50',
          borderRadius: 2
        }}
      >
        <Alert severity="info" sx={{ bgcolor: 'white', border: '1px solid', borderColor: '#a5d6a7' }}>
          <Typography variant="body2">
            A termék típus hozzárendelése szükséges az attribútumok hozzáadásához. Válasszon termék típust a 3. lépésben.
          </Typography>
        </Alert>
      </Paper>
    )
  }

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
          border: '2px solid',
          borderColor: '#4caf50',
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
            background: 'radial-gradient(circle, rgba(76, 175, 80, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(30px, -30px)'
          }
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
            <LabelIcon sx={{ color: 'white', fontSize: '24px' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
            Attribútumok
          </Typography>
          <Chip
            label={currentAttributes.length}
            size="small"
            sx={{
              bgcolor: '#4caf50',
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
          {currentAttributes.map((attr: any, index: number) => {
            const displayName = attr.display_name || attr.name || 'Ismeretlen'
            let displayValue: string = 'Nincs érték'
            
            if (attr.value !== null && attr.value !== undefined && attr.value !== '') {
              // For LIST attributes, show the value ID (we'll improve this later with proper value fetching)
              // For other types, show the value directly
              if (attr.type === 'LIST') {
                displayValue = String(attr.listAttributeValueId || attr.value)
              } else {
                displayValue = String(attr.value)
              }
            }

            return (
              <Chip
                key={index}
                label={`${displayName}: ${displayValue}`}
                size="small"
                onDelete={() => handleDeleteAttribute(index)}
                deleteIcon={<CloseIcon fontSize="small" />}
                onClick={() => handleEditAttribute(index)}
                sx={{
                  fontSize: '0.875rem',
                  height: '36px',
                  bgcolor: 'white',
                  border: '1px solid',
                  borderColor: '#4caf50',
                  color: '#2e7d32',
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: '#e8f5e9',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(76, 175, 80, 0.2)',
                    transition: 'all 0.2s ease',
                    '& .MuiChip-deleteIcon': {
                      opacity: 1
                    }
                  },
                  '& .MuiChip-deleteIcon': {
                    color: '#2e7d32',
                    fontSize: '16px',
                    opacity: 0.7,
                    '&:hover': {
                      color: '#1b5e20',
                      bgcolor: '#e8f5e9',
                      borderRadius: '50%'
                    },
                    transition: 'all 0.2s ease'
                  },
                  transition: 'all 0.2s ease'
                }}
              />
            )
          })}
          {currentAttributes.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', width: '100%' }}>
              Nincs hozzárendelt attribútum
            </Typography>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={handleOpenAddModal}
            disabled={loading || availableAttributes.length === 0}
            sx={{
              height: '36px',
              borderColor: '#4caf50',
              color: '#2e7d32',
              fontSize: '0.875rem',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#388e3c',
                bgcolor: '#e8f5e9'
              },
              '&.Mui-disabled': {
                borderColor: '#a5d6a7',
                color: '#81c784'
              },
              transition: 'all 0.2s ease'
            }}
          >
            Attribútum hozzáadása
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt: 2, bgcolor: 'white', border: '1px solid', borderColor: '#a5d6a7' }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Add/Edit Attribute Modal */}
      <Dialog
        open={addModalOpen}
        onClose={handleCloseAddModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '2px solid',
            borderColor: '#4caf50'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#e8f5e9',
          borderBottom: '1px solid',
          borderColor: '#a5d6a7',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          <LabelIcon sx={{ color: '#4caf50' }} />
          <Box component="span" sx={{ fontWeight: 700, color: '#2e7d32', fontSize: '1.25rem' }}>
            {editAttributeIndex !== null ? 'Attribútum szerkesztése' : 'Attribútum hozzáadása'}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableAttributes.length === 0 && editAttributeIndex === null ? (
            <Alert severity="info">
              Nincs elérhető attribútum a termék típushoz.
            </Alert>
          ) : (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Attribútum</InputLabel>
                <Select
                  value={selectedAttributeId}
                  label="Attribútum"
                  onChange={(e) => {
                    setSelectedAttributeId(e.target.value)
                    setNewAttributeValue(null)
                  }}
                  disabled={editAttributeIndex !== null}
                >
                  {(editAttributeIndex !== null ? [selectedAttribute] : availableAttributes)
                    .filter(Boolean)
                    .map((attr) => (
                      <MenuItem key={attr.id} value={attr.id}>
                        {attr.name} ({attr.type})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              {selectedAttribute && (() => {
                if (selectedAttribute.type === 'LIST') {
                  return (
                    <FormControl fullWidth>
                      <InputLabel>Érték</InputLabel>
                      <Select
                        value={newAttributeValue || ''}
                        label="Érték"
                        onChange={(e) => setNewAttributeValue(e.target.value)}
                        disabled={loadingListValues}
                      >
                        {loadingListValues ? (
                          <MenuItem value="" disabled>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={16} />
                              Betöltés...
                            </Box>
                          </MenuItem>
                        ) : listAttributeValues.length > 0 ? (
                          listAttributeValues.map((val) => (
                            <MenuItem key={val.id} value={val.id}>
                              {val.displayValue || val.value}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem value="" disabled>
                            Nincs elérhető érték
                          </MenuItem>
                        )}
                      </Select>
                    </FormControl>
                  )
                } else if (selectedAttribute.type === 'INTEGER' || selectedAttribute.type === 'FLOAT') {
                  return (
                    <TextField
                      fullWidth
                      type="number"
                      label="Érték"
                      value={newAttributeValue || ''}
                      onChange={(e) => setNewAttributeValue(selectedAttribute.type === 'FLOAT' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
                    />
                  )
                } else {
                  return (
                    <TextField
                      fullWidth
                      label="Érték"
                      value={newAttributeValue || ''}
                      onChange={(e) => setNewAttributeValue(e.target.value)}
                      multiline
                      rows={3}
                    />
                  )
                }
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddModal}>
            Mégse
          </Button>
          <Button
            onClick={editAttributeIndex !== null ? handleSaveEdit : handleAddAttribute}
            variant="contained"
            disabled={!selectedAttributeId || newAttributeValue === null || newAttributeValue === ''}
            sx={{
              bgcolor: '#4caf50',
              color: 'white',
              '&:hover': {
                bgcolor: '#388e3c'
              },
              '&.Mui-disabled': {
                bgcolor: '#a5d6a7',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
            startIcon={<AddIcon />}
          >
            {editAttributeIndex !== null ? 'Mentés' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

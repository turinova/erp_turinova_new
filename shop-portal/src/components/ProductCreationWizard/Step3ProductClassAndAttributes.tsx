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
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid
} from '@mui/material'
import { LocalOffer as LocalOfferIcon, Label as LabelIcon, Add as AddIcon, Edit as EditIcon, Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material'

interface Step3ProductClassAndAttributesProps {
  connectionId: string | null
  selectedProductClassId: string | null
  attributes: any[] | null
  onProductClassSelect: (productClassId: string | null) => void
  onAttributesChange: (attributes: any[]) => void
}

interface ProductClass {
  id: string
  name: string
  description?: string | null
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

export default function Step3ProductClassAndAttributes({
  connectionId,
  selectedProductClassId,
  attributes,
  onProductClassSelect,
  onAttributesChange
}: Step3ProductClassAndAttributesProps) {
  // Product Class state
  const [productClasses, setProductClasses] = useState<ProductClass[]>([])
  const [loadingProductClass, setLoadingProductClass] = useState(false)
  const [productClassError, setProductClassError] = useState<string | null>(null)
  const [productClassModalOpen, setProductClassModalOpen] = useState(false)
  const [productClassSearchTerm, setProductClassSearchTerm] = useState('')
  const [selectedProductClassIdTemp, setSelectedProductClassIdTemp] = useState<string>(selectedProductClassId || '')

  // Attributes state
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([])
  const [loadingAttributes, setLoadingAttributes] = useState(false)
  const [attributesError, setAttributesError] = useState<string | null>(null)
  const [addAttributeModalOpen, setAddAttributeModalOpen] = useState(false)
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>('')
  const [newAttributeValue, setNewAttributeValue] = useState<any>(null)
  const [listAttributeValues, setListAttributeValues] = useState<ListAttributeValue[]>([])
  const [loadingListValues, setLoadingListValues] = useState(false)
  const [editAttributeIndex, setEditAttributeIndex] = useState<number | null>(null)

  const currentAttributes = Array.isArray(attributes) ? attributes : (attributes ? [attributes] : [])

  // Load product classes
  useEffect(() => {
    if (connectionId) {
      loadProductClasses()
    } else {
      setProductClasses([])
    }
  }, [connectionId])

  useEffect(() => {
    setSelectedProductClassIdTemp(selectedProductClassId || '')
  }, [selectedProductClassId])

  // Load available attributes when product class changes
  useEffect(() => {
    if (connectionId && selectedProductClassId) {
      loadAvailableAttributes()
    } else {
      setAvailableAttributes([])
    }
  }, [connectionId, selectedProductClassId])

  useEffect(() => {
    // Filter out already added attributes
    if (availableAttributes.length > 0 && currentAttributes.length > 0) {
      const addedIds = new Set(currentAttributes.map((attr: any) => attr.id || attr.attribute_shoprenter_id))
      setAvailableAttributes(prev => prev.filter(attr => !addedIds.has(attr.id)))
    }
  }, [currentAttributes])

  const loadProductClasses = async () => {
    if (!connectionId) return

    setLoadingProductClass(true)
    setProductClassError(null)
    try {
      const response = await fetch(`/api/connections/${connectionId}/product-classes`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProductClasses(data.productClasses || [])
        } else {
          setProductClassError(data.error || 'Hiba a termék típusok betöltésekor')
        }
      } else {
        const errorData = await response.json()
        setProductClassError(errorData.error || 'Hiba a termék típusok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading product classes:', error)
      setProductClassError('Hiba a termék típusok betöltésekor')
    } finally {
      setLoadingProductClass(false)
    }
  }

  const loadAvailableAttributes = async () => {
    if (!connectionId || !selectedProductClassId) return

    setLoadingAttributes(true)
    setAttributesError(null)
    try {
      const response = await fetch(
        `/api/products/new/attributes/available?connectionId=${connectionId}&productClassId=${selectedProductClassId}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Filter out already added attributes
          const addedIds = new Set(currentAttributes.map((attr: any) => attr.id || attr.attribute_shoprenter_id))
          setAvailableAttributes((data.attributes || []).filter((attr: Attribute) => !addedIds.has(attr.id)))
        } else {
          setAttributesError(data.error || 'Hiba az attribútumok betöltésekor')
        }
      } else {
        const errorData = await response.json()
        setAttributesError(errorData.error || 'Hiba az attribútumok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading attributes:', error)
      setAttributesError('Hiba az attribútumok betöltésekor')
    } finally {
      setLoadingAttributes(false)
    }
  }

  const loadListAttributeValues = async (attributeId: string) => {
    if (!connectionId) return

    setLoadingListValues(true)
    try {
      const response = await fetch(`/api/connections/${connectionId}/list-attribute-values?attributeId=${attributeId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setListAttributeValues(data.values || [])
        }
      } else {
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
    if (selectedAttributeId && addAttributeModalOpen) {
      const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId)
      if (selectedAttr?.type === 'LIST') {
        loadListAttributeValues(selectedAttributeId)
      } else {
        setListAttributeValues([])
      }
      setNewAttributeValue(null)
    }
  }, [selectedAttributeId, addAttributeModalOpen])

  // Product Class handlers
  const handleOpenProductClassModal = () => {
    setProductClassModalOpen(true)
    setSelectedProductClassIdTemp(selectedProductClassId || '')
    setProductClassSearchTerm('')
  }

  const handleCloseProductClassModal = () => {
    setProductClassModalOpen(false)
    setSelectedProductClassIdTemp(selectedProductClassId || '')
    setProductClassSearchTerm('')
  }

  const handleSaveProductClass = () => {
    const newProductClassId = selectedProductClassIdTemp || null
    // Clear attributes if product class changes
    if (selectedProductClassId !== newProductClassId && currentAttributes.length > 0) {
      onAttributesChange([])
    }
    onProductClassSelect(newProductClassId)
    setProductClassModalOpen(false)
  }

  const handleRemoveProductClass = () => {
    onProductClassSelect(null)
    onAttributesChange([])
    setProductClassModalOpen(false)
  }

  // Attributes handlers
  const handleOpenAddAttributeModal = () => {
    setAddAttributeModalOpen(true)
    setSelectedAttributeId('')
    setNewAttributeValue(null)
    loadAvailableAttributes()
  }

  const handleCloseAddAttributeModal = () => {
    setAddAttributeModalOpen(false)
    setSelectedAttributeId('')
    setNewAttributeValue(null)
    setEditAttributeIndex(null)
  }

  const handleAddAttribute = () => {
    if (!selectedAttributeId || newAttributeValue === null || newAttributeValue === '') return

    const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId)
    if (!selectedAttr) return

    // For LIST attributes, find the display value from listAttributeValues
    let displayValue: string | null = null
    if (selectedAttr.type === 'LIST') {
      const selectedValue = listAttributeValues.find(v => v.id === newAttributeValue)
      displayValue = selectedValue?.displayValue || selectedValue?.value || String(newAttributeValue)
    } else {
      displayValue = String(newAttributeValue)
    }

    const newAttr = {
      id: selectedAttr.id,
      attribute_shoprenter_id: selectedAttr.id,
      name: selectedAttr.name,
      display_name: selectedAttr.name,
      type: selectedAttr.type,
      value: selectedAttr.type === 'LIST' ? displayValue : newAttributeValue,
      ...(selectedAttr.type === 'LIST' && { 
        listAttributeValueId: newAttributeValue,
        listAttributeValueDisplay: displayValue
      })
    }

    const updated = [...currentAttributes, newAttr]
    onAttributesChange(updated)
    handleCloseAddAttributeModal()
  }

  const handleDeleteAttribute = (index: number) => {
    const updated = currentAttributes.filter((_: any, i: number) => i !== index)
    onAttributesChange(updated.length > 0 ? updated : null)
  }

  const handleEditAttribute = async (index: number) => {
    setEditAttributeIndex(index)
    const attr = currentAttributes[index]
    setSelectedAttributeId(attr.id || attr.attribute_shoprenter_id)
    
    if (attr.type === 'LIST') {
      // For LIST attributes, use listAttributeValueId if available
      setNewAttributeValue(attr.listAttributeValueId || attr.value)
      // Load list values first, then set the value
      await loadListAttributeValues(attr.id || attr.attribute_shoprenter_id)
      // After loading, ensure we have the correct ID set
      if (attr.listAttributeValueId) {
        setNewAttributeValue(attr.listAttributeValueId)
      }
    } else {
      setNewAttributeValue(attr.value)
    }
    
    setAddAttributeModalOpen(true)
  }

  const handleSaveEdit = () => {
    if (editAttributeIndex === null || !selectedAttributeId || newAttributeValue === null || newAttributeValue === '') return

    const selectedAttr = availableAttributes.find(a => a.id === selectedAttributeId) || 
                        currentAttributes.find((a: any) => (a.id || a.attribute_shoprenter_id) === selectedAttributeId)
    if (!selectedAttr) return

    // For LIST attributes, find the display value from listAttributeValues
    let displayValue: string | null = null
    if (selectedAttr.type === 'LIST') {
      const selectedValue = listAttributeValues.find(v => v.id === newAttributeValue)
      displayValue = selectedValue?.displayValue || selectedValue?.value || String(newAttributeValue)
    } else {
      displayValue = String(newAttributeValue)
    }

    const updated = [...currentAttributes]
    updated[editAttributeIndex] = {
      ...updated[editAttributeIndex],
      value: selectedAttr.type === 'LIST' ? displayValue : newAttributeValue,
      ...(selectedAttr.type === 'LIST' && { 
        listAttributeValueId: newAttributeValue,
        listAttributeValueDisplay: displayValue
      })
    }
    onAttributesChange(updated)
    handleCloseAddAttributeModal()
  }

  const filteredProductClasses = productClasses.filter(pc =>
    pc.name.toLowerCase().includes(productClassSearchTerm.toLowerCase()) ||
    (pc.description && pc.description.toLowerCase().includes(productClassSearchTerm.toLowerCase()))
  )

  const selectedProductClass = productClasses.find(pc => pc.id === selectedProductClassId)
  const selectedAttribute = availableAttributes.find(a => a.id === selectedAttributeId) ||
                           currentAttributes.find((a: any) => (a.id || a.attribute_shoprenter_id) === selectedAttributeId)

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  return (
    <>
      <Grid container spacing={3}>
        {/* Product Class Section - Blue Theme */}
        <Grid item xs={12}>
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
              {loadingProductClass ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Betöltés...
                  </Typography>
                </Box>
              ) : selectedProductClass ? (
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
                    onClick={handleOpenProductClassModal}
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
                  onClick={handleOpenProductClassModal}
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
        </Grid>

        {/* Attributes Section - Green Theme */}
        <Grid item xs={12}>
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

            {!selectedProductClass ? (
              <Alert severity="info" sx={{ bgcolor: 'white', border: '1px solid', borderColor: '#a5d6a7', position: 'relative', zIndex: 1 }}>
                <Typography variant="body2">
                  A termék típus hozzárendelése szükséges az attribútumok hozzáadásához.
                </Typography>
              </Alert>
            ) : (
              <>
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
                      if (attr.type === 'LIST') {
                        // Use stored display value if available, otherwise use the value
                        displayValue = attr.listAttributeValueDisplay || attr.value || String(attr.listAttributeValueId || 'Nincs érték')
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
                    onClick={handleOpenAddAttributeModal}
                    disabled={loadingAttributes || availableAttributes.length === 0}
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

                {loadingAttributes && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {attributesError && (
                  <Alert severity="warning" sx={{ mt: 2, bgcolor: 'white', border: '1px solid', borderColor: '#a5d6a7' }}>
                    {attributesError}
                  </Alert>
                )}
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Product Class Selection Modal */}
      <Dialog
        open={productClassModalOpen}
        onClose={handleCloseProductClassModal}
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
            value={productClassSearchTerm}
            onChange={(e) => setProductClassSearchTerm(e.target.value)}
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
              {productClassSearchTerm
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
                value={selectedProductClassIdTemp}
                onChange={(e) => setSelectedProductClassIdTemp(e.target.value)}
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
                        onClick={() => setSelectedProductClassIdTemp(pc.id)}
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
              onClick={handleRemoveProductClass}
              color="error"
              sx={{ mr: 'auto' }}
            >
              Eltávolítás
            </Button>
          )}
          <Button onClick={handleCloseProductClassModal}>
            Mégse
          </Button>
          <Button
            onClick={handleSaveProductClass}
            variant="contained"
            disabled={!selectedProductClassIdTemp}
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

      {/* Add/Edit Attribute Modal */}
      <Dialog
        open={addAttributeModalOpen}
        onClose={handleCloseAddAttributeModal}
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
          {loadingAttributes ? (
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
          <Button onClick={handleCloseAddAttributeModal}>
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

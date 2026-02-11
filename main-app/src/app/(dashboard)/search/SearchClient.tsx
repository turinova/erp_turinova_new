'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Link, 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Chip, 
  CircularProgress,
  InputAdornment,
  IconButton,
  Popover,
  Tooltip
} from '@mui/material'
import { Home as HomeIcon, Search as SearchIcon, Info as InfoIcon } from '@mui/icons-material'

interface Material {
  id: string
  name: string
  brand_id: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  price_per_sqm: number
  vat_id: string
  brands: { name: string } | null
  vat: { kulcs: number }
  quantity_on_hand: number | null
}

interface LinearMaterial {
  id: string
  name: string
  brand_id: string
  length: number
  width: number
  thickness: number
  price_per_m: number
  vat_id: string
  type: string
  brands: { name: string } | null
  vat: { kulcs: number }
  quantity_on_hand: number | null
}

interface SearchResults {
  materials: Material[]
  linearMaterials: LinearMaterial[]
}

export default function SearchClient() {
  // Temporarily bypass permission check for testing
  const hasAccess = true
  
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<SearchResults>({ materials: [], linearMaterials: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Debounced search effect
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults({ materials: [], linearMaterials: [] })
      setHasSearched(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
          setHasSearched(true)
        } else {
          console.error('Search failed:', response.statusText)
          setResults({ materials: [], linearMaterials: [] })
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults({ materials: [], linearMaterials: [] })
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce for lightning-fast feel

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Calculate prices with VAT
  const formatPrice = (price: number): string => {
    return price.toLocaleString('hu-HU') + ' Ft'
  }

  const calculatePrices = (item: Material | LinearMaterial, isLinear: boolean) => {
    const vatRate = item.vat.kulcs / 100
    const grossMultiplier = 1 + vatRate
    
    if (isLinear) {
      const linearItem = item as LinearMaterial
      const fmAr = Math.round(linearItem.price_per_m * grossMultiplier)
      const egeszAr = Math.round(linearItem.price_per_m * grossMultiplier * linearItem.length / 1000)
      return { fmAr, egeszAr }
    } else {
      const materialItem = item as Material
      const nmAr = Math.round(materialItem.price_per_sqm * grossMultiplier)
      const egeszAr = Math.round(materialItem.price_per_sqm * grossMultiplier * materialItem.width_mm * materialItem.length_mm / 1000000)
      return { nmAr, egeszAr }
    }
  }

  // Combine and sort results
  const allResults = useMemo(() => {
    const combined: Array<(Material | LinearMaterial) & { isLinear: boolean }> = [
      ...results.materials.map(item => ({ ...item, isLinear: false as const })),
      ...results.linearMaterials.map(item => ({ ...item, isLinear: true as const }))
    ]
    return combined
  }, [results])

  // Popover state for accessories
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [accessoryRows, setAccessoryRows] = useState<{ id: string; name: string; sku: string; partner_name: string }[]>([])
  const [loadingAccessories, setLoadingAccessories] = useState(false)
  const [currentItemId, setCurrentItemId] = useState<string | null>(null)
  const [currentItemType, setCurrentItemType] = useState<'material' | 'linear_material' | null>(null)

  const handleOpenAccessories = async (event: React.MouseEvent<HTMLElement>, itemId: string, isLinear: boolean) => {
    setAnchorEl(event.currentTarget)
    setCurrentItemId(itemId)
    setCurrentItemType(isLinear ? 'linear_material' : 'material')
    setLoadingAccessories(true)
    
    try {
      const endpoint = isLinear 
        ? `/api/linear-materials/${itemId}/accessories`
        : `/api/materials/${itemId}/accessories`
      
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        // Transform the data to match expected format
        // Handle both material and linear_material API response formats
        const transformed = data.map((item: any) => {
          // Material accessories API returns { accessory: {...} }
          // Linear material accessories API returns { accessory: {...} } (same structure)
          const accessory = item.accessory
          return {
            id: accessory?.id || item.accessory_id,
            name: accessory?.name || '',
            sku: accessory?.sku || '',
            partner_name: accessory?.partner_name || accessory?.partners?.name || ''
          }
        })
        setAccessoryRows(transformed)
      } else {
        console.error('Failed to fetch accessories:', response.statusText)
        setAccessoryRows([])
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
      setAccessoryRows([])
    } finally {
      setLoadingAccessories(false)
    }
  }

  const handleCloseAccessories = () => {
    setAnchorEl(null)
    setAccessoryRows([])
    setCurrentItemId(null)
    setCurrentItemType(null)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Kereső
        </Typography>
      </Breadcrumbs>
      
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Kereső
      </Typography>
      
      <TextField
        fullWidth
        placeholder="Keresés anyagok között..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isLoading ? <CircularProgress size={20} /> : <SearchIcon />}
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />

      {hasSearched && allResults.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Márka</strong></TableCell>
                <TableCell><strong>Megnevezés</strong></TableCell>
                <TableCell><strong>Típus</strong></TableCell>
                <TableCell><strong>Hosszúság</strong></TableCell>
                <TableCell><strong>Szélesség</strong></TableCell>
                <TableCell><strong>Vastagság</strong></TableCell>
                <TableCell sx={{ backgroundColor: '#E3F2FD', color: '#1976D2' }}>
                  <strong>Fm ár</strong>
                </TableCell>
                <TableCell sx={{ backgroundColor: '#E8F5E8', color: '#2E7D32' }}>
                  <strong>Nm ár</strong>
                </TableCell>
                <TableCell><strong>Egész ár</strong></TableCell>
                <TableCell><strong>Készlet</strong></TableCell>
                <TableCell align="center"><strong>Élzárók</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allResults.map((item, index) => {
                const isLinear = item.isLinear
                const prices = calculatePrices(item, isLinear)
                
                // Type-safe access to properties
                const type = isLinear ? (item as LinearMaterial).type : "Bútorlap"
                const length = isLinear ? (item as LinearMaterial).length : (item as Material).length_mm
                const width = isLinear ? (item as LinearMaterial).width : (item as Material).width_mm
                const thickness = isLinear ? (item as LinearMaterial).thickness : (item as Material).thickness_mm
                
                return (
                  <TableRow key={`${isLinear ? 'linear' : 'material'}-${item.id}`}>
                    <TableCell>{item.brands?.name || '-'}</TableCell>
                    <TableCell>
                      <Link
                        href={isLinear ? `/linear-materials/${item.id}/edit` : `/materials/${item.id}/edit`}
                        underline="hover"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={type} 
                        size="small" 
                        color={isLinear ? "primary" : "secondary"}
                        variant="filled"
                        sx={{
                          backgroundColor: isLinear ? '#2196F3' : '#F44336',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {`${length} mm`}
                    </TableCell>
                    <TableCell>
                      {`${width} mm`}
                    </TableCell>
                    <TableCell>
                      {`${thickness} mm`}
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: isLinear ? '#E3F2FD' : 'transparent',
                      fontWeight: isLinear ? 'bold' : 'normal',
                      color: isLinear ? '#1976D2' : 'inherit'
                    }}>
                      {isLinear && prices.fmAr !== undefined ? formatPrice(prices.fmAr) : '-'}
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: !isLinear ? '#E8F5E8' : 'transparent',
                      fontWeight: !isLinear ? 'bold' : 'normal',
                      color: !isLinear ? '#2E7D32' : 'inherit'
                    }}>
                      {!isLinear && prices.nmAr !== undefined ? formatPrice(prices.nmAr) : '-'}
                    </TableCell>
                    <TableCell>
                      {prices.egeszAr !== undefined ? formatPrice(prices.egeszAr) : '-'}
                    </TableCell>
                    <TableCell>
                      {item.quantity_on_hand !== null && item.quantity_on_hand !== undefined
                        ? `${Number(item.quantity_on_hand).toFixed(2)} ${isLinear ? 'm' : 'm²'}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Kapcsolt élzárók megtekintése">
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleOpenAccessories(e, item.id, item.isLinear)}
                          disabled={loadingAccessories && currentItemId === item.id}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleCloseAccessories}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 800, maxHeight: 260, overflowY: 'auto' }}>
          <Typography variant="subtitle1" gutterBottom>Kapcsolt élzárók</Typography>
          {loadingAccessories ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : accessoryRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nincs élzáró.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Partner</TableCell>
                  <TableCell>Név</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accessoryRows.map((acc, idx) => (
                  <TableRow key={acc.id || acc.sku || idx}>
                    <TableCell>{acc.partner_name || '-'}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Popover>

      {hasSearched && allResults.length === 0 && !isLoading && (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
          Nincs találat a keresési feltételre: "{searchTerm}"
        </Typography>
      )}
    </Box>
  )
}

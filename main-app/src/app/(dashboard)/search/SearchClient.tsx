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
  Tooltip,
  TableSizeType
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
  accessories?: {
    id: string
    name: string
    sku: string
    partner_name: string
  }[]
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
  accessories?: {
    id: string
    name: string
    sku: string
    partner_name: string
  }[]
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
    const combined = [
      ...results.materials.map(item => ({ ...item, isLinear: false })),
      ...results.linearMaterials.map(item => ({ ...item, isLinear: true }))
    ]
    return combined
  }, [results])

  // Popover state for accessories
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [accessoryRows, setAccessoryRows] = useState<{ id: string; name: string; sku: string; partner_name: string }[]>([])
  const handleOpenAccessories = (event: React.MouseEvent<HTMLElement>, accessories: any[] = []) => {
    setAccessoryRows(accessories || [])
    setAnchorEl(event.currentTarget)
  }
  const handleCloseAccessories = () => {
    setAnchorEl(null)
    setAccessoryRows([])
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
                <TableCell align="center"><strong>Élzárók</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allResults.map((item, index) => {
                const prices = calculatePrices(item, item.isLinear)
                return (
                  <TableRow key={`${item.isLinear ? 'linear' : 'material'}-${item.id}`}>
                    <TableCell>{item.brands?.name || '-'}</TableCell>
                    <TableCell>
                      <Link
                        href={item.isLinear ? `/linear-materials/${item.id}/edit` : `/materials/${item.id}/edit`}
                        underline="hover"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.isLinear ? item.type : "Bútorlap"} 
                        size="small" 
                        color={item.isLinear ? "primary" : "secondary"}
                        variant="filled"
                        sx={{
                          backgroundColor: item.isLinear ? '#2196F3' : '#F44336',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {item.isLinear ? `${item.length} mm` : `${item.length_mm} mm`}
                    </TableCell>
                    <TableCell>
                      {item.isLinear ? `${item.width} mm` : `${item.width_mm} mm`}
                    </TableCell>
                    <TableCell>
                      {item.isLinear ? `${item.thickness} mm` : `${item.thickness_mm} mm`}
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: item.isLinear ? '#E3F2FD' : 'transparent',
                      fontWeight: item.isLinear ? 'bold' : 'normal',
                      color: item.isLinear ? '#1976D2' : 'inherit'
                    }}>
                      {item.isLinear ? formatPrice(prices.fmAr) : '-'}
                    </TableCell>
                    <TableCell sx={{ 
                      backgroundColor: !item.isLinear ? '#E8F5E8' : 'transparent',
                      fontWeight: !item.isLinear ? 'bold' : 'normal',
                      color: !item.isLinear ? '#2E7D32' : 'inherit'
                    }}>
                      {!item.isLinear ? formatPrice(prices.nmAr) : '-'}
                    </TableCell>
                    <TableCell>
                      {formatPrice(prices.egeszAr)}
                    </TableCell>
                    <TableCell align="center">
                      {(item.accessories && item.accessories.length > 0) ? (
                        <Tooltip title="Kapcsolt élzárók megtekintése">
                          <IconButton size="small" onClick={(e) => handleOpenAccessories(e, item.accessories)}>
                            <InfoIcon fontSize="small" />
                            <Chip label={item.accessories.length} size="small" sx={{ ml: 0.5 }} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
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
        <Box sx={{ p: 2, maxWidth: 420 }}>
          <Typography variant="subtitle1" gutterBottom>Kapcsolt élzárók</Typography>
          {accessoryRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nincs élzáró.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Partner</TableCell>
                  <TableCell>Név</TableCell>
                  <TableCell>SKU</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accessoryRows.map((acc) => (
                  <TableRow key={acc.id || acc.sku}>
                    <TableCell>{acc.partner_name || '-'}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell>{acc.sku}</TableCell>
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

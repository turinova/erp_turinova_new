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
  Card,
  CardContent,
  Stack,
  Divider
} from '@mui/material'
import { 
  Home as HomeIcon, 
  Search as SearchIcon,
  InfoOutlined as InfoOutlinedIcon,
  CheckCircleOutline as CheckCircleOutlineIcon
} from '@mui/icons-material'

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

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/home"
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
      
      <Card
        sx={{
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'primary.light',
          backgroundColor: 'rgba(17, 170, 136, 0.06)'
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <InfoOutlinedIcon color="primary" sx={{ fontSize: 36, mt: 0.5 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Ár tájékoztató
                </Typography>
                <Typography variant="body1" color="text.primary" sx={{ mt: 0.5 }}>
                  Ebben a keresőben egyszerűen és gyorsan megtekintheti a kiválasztott vállalkozás <strong>bútorlap</strong>, munkalap, asztallap és hátfalpanel árait. Csak kezdje el beírni a termék kódját, és a rendszer automatikusan megjeleníti:
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircleOutlineIcon color="primary" fontSize="small" />
                Fontos tudnivalók
              </Typography>
              <Box component="ul" sx={{ pl: 4, m: 0, color: 'text.secondary', display: 'grid', gap: 1 }}>
                <Box component="li">
                  Az árak bruttó árak és tájékoztató jellegűek.
                </Box>
                <Box component="li">
                  Az árváltoztatás jogát fenntartjuk.
                </Box>
                <Box component="li">
                  Az esetleges eltérésekért vagy hibás megjelenített adatokért nem vállalunk felelősséget.
                </Box>
              </Box>
            </Box>

            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
              Kezdje el gépelni a keresett termék kódját, és már láthatja is az aktuális árakat.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

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
              </TableRow>
            </TableHead>
            <TableBody>
              {allResults.map((item, index) => {
                const prices = calculatePrices(item, item.isLinear)
                return (
                  <TableRow key={`${item.isLinear ? 'linear' : 'material'}-${item.id}`}>
                    <TableCell>{item.brands?.name || '-'}</TableCell>
                    <TableCell>{item.name}</TableCell>
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {hasSearched && allResults.length === 0 && !isLoading && (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
          Nincs találat a keresési feltételre: "{searchTerm}"
        </Typography>
      )}
    </Box>
  )
}

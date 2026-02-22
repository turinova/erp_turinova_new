'use client'

import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Checkbox,
  Alert,
  AlertTitle
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  OpenInNew as OpenInNewIcon,
  Warning as WarningIcon,
  AttachMoney as AttachMoneyIcon,
  FilterList as FilterListIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'

interface PriceComparison {
  linkId: string
  productId: string
  sku: string
  productName: string | null
  modelNumber: string | null
  ourPrice: number
  competitorName: string
  competitorId?: string
  competitorPrice: number
  difference: number
  percentDiff: number
  lastChecked: string | null
  daysSinceCheck: number | null
  competitorUrl: string
  inStock: boolean | null
}

interface Props {
  priceComparisons: PriceComparison[]
}

export default function ExpensiveProductsTab({ priceComparisons }: Props) {
  const router = useRouter()
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all')
  const [priceRange, setPriceRange] = useState<string>('all')
  const [percentDiffRange, setPercentDiffRange] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'percentDiff' | 'ourPrice' | 'difference'>('percentDiff')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

  // Filter to only products where we're more expensive
  const expensiveProducts = useMemo(() => {
    return priceComparisons.filter(p => p.percentDiff > 0)
  }, [priceComparisons])

  // Get unique competitors
  const competitors = useMemo(() => {
    const comps = new Map<string, string>()
    expensiveProducts.forEach(p => {
      if (p.competitorId && p.competitorName) {
        comps.set(p.competitorId, p.competitorName)
      }
    })
    return Array.from(comps.entries()).map(([id, name]) => ({ id, name }))
  }, [expensiveProducts])

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = expensiveProducts

    // Filter by competitor
    if (selectedCompetitor !== 'all') {
      filtered = filtered.filter(p => p.competitorId === selectedCompetitor)
    }

    // Filter by price range
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(Number)
      if (max) {
        filtered = filtered.filter(p => p.ourPrice >= min && p.ourPrice <= max)
      } else {
        filtered = filtered.filter(p => p.ourPrice >= min)
      }
    }

    // Filter by percent difference
    if (percentDiffRange !== 'all') {
      const [min, max] = percentDiffRange.split('-').map(Number)
      if (max) {
        filtered = filtered.filter(p => p.percentDiff >= min && p.percentDiff <= max)
      } else {
        filtered = filtered.filter(p => p.percentDiff >= min)
      }
    }

    // Sort
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      let aVal: number
      let bVal: number

      if (sortBy === 'percentDiff') {
        aVal = a.percentDiff
        bVal = b.percentDiff
      } else if (sortBy === 'ourPrice') {
        aVal = a.ourPrice
        bVal = b.ourPrice
      } else {
        aVal = a.difference
        bVal = b.difference
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    return sorted
  }, [expensiveProducts, selectedCompetitor, priceRange, percentDiffRange, sortBy, sortOrder])

  // Calculate summary metrics
  const summary = useMemo(() => {
    const total = filteredData.length
    const totalRevenueAtRisk = filteredData.reduce((sum, p) => sum + p.difference, 0)
    const avgPercentDiff = total > 0 
      ? filteredData.reduce((sum, p) => sum + p.percentDiff, 0) / total 
      : 0
    const quickWins = filteredData.filter(p => p.percentDiff > 2 && p.percentDiff <= 5).length
    const urgent = filteredData.filter(p => p.percentDiff > 10).length

    return {
      total,
      totalRevenueAtRisk,
      avgPercentDiff,
      quickWins,
      urgent
    }
  }, [filteredData])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', { 
      style: 'currency', 
      currency: 'HUF',
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatPercent = (percent: number) => {
    return `+${percent.toFixed(1)}%`
  }

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  const toggleProductSelection = (linkId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(linkId)) {
      newSelected.delete(linkId)
    } else {
      newSelected.add(linkId)
    }
    setSelectedProducts(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredData.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredData.map(p => p.linkId)))
    }
  }

  const handleBulkAction = (action: 'analyze' | 'export') => {
    if (selectedProducts.size === 0) {
      alert('Válasszon ki legalább egy terméket')
      return
    }
    
    if (action === 'analyze') {
      // TODO: Implement bulk analysis
      alert(`${selectedProducts.size} termék elemzése...`)
    } else if (action === 'export') {
      // TODO: Implement export
      alert(`${selectedProducts.size} termék exportálása...`)
    }
  }

  if (expensiveProducts.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            🎉 Kiváló hír!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nincs olyan termék ahol drágábbak lennénk a versenytársaknál!
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <WarningIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {summary.total}
              </Typography>
              <Typography variant="body2">
                Drágább termék
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <AttachMoneyIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {formatPrice(summary.totalRevenueAtRisk)}
              </Typography>
              <Typography variant="body2">
                Bevétel kockázatban
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="h3" fontWeight={700} color="text.primary">
                {summary.avgPercentDiff.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Átlagos különbség
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="h3" fontWeight={700}>
                {summary.quickWins}
              </Typography>
              <Typography variant="body2">
                Gyors győzelem (2-5%)
              </Typography>
              {summary.urgent > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}>
                  {summary.urgent} sürgős ({'>'}10%)
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Priority Alert */}
      {summary.urgent > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Sürgős figyelem!</AlertTitle>
          <Typography variant="body2">
            {summary.urgent} terméknél több mint 10%-kal drágábbak vagyunk. Ezeket prioritásként kezeljük!
          </Typography>
        </Alert>
      )}

      {/* Filters and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Versenytárs</InputLabel>
                <Select
                  value={selectedCompetitor}
                  label="Versenytárs"
                  onChange={(e) => setSelectedCompetitor(e.target.value)}
                >
                  <MenuItem value="all">Összes</MenuItem>
                  {competitors.map(comp => (
                    <MenuItem key={comp.id} value={comp.id}>
                      {comp.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Ár tartomány</InputLabel>
                <Select
                  value={priceRange}
                  label="Ár tartomány"
                  onChange={(e) => setPriceRange(e.target.value)}
                >
                  <MenuItem value="all">Összes</MenuItem>
                  <MenuItem value="0-20000">0 - 20,000 Ft</MenuItem>
                  <MenuItem value="20000-50000">20,000 - 50,000 Ft</MenuItem>
                  <MenuItem value="50000-100000">50,000 - 100,000 Ft</MenuItem>
                  <MenuItem value="100000-">100,000+ Ft</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Különbség %</InputLabel>
                <Select
                  value={percentDiffRange}
                  label="Különbség %"
                  onChange={(e) => setPercentDiffRange(e.target.value)}
                >
                  <MenuItem value="all">Összes</MenuItem>
                  <MenuItem value="0-2">0 - 2%</MenuItem>
                  <MenuItem value="2-5">2 - 5%</MenuItem>
                  <MenuItem value="5-10">5 - 10%</MenuItem>
                  <MenuItem value="10-">10%+</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Rendezés</InputLabel>
                <Select
                  value={sortBy}
                  label="Rendezés"
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <MenuItem value="percentDiff">Különbség %</MenuItem>
                  <MenuItem value="ourPrice">Árunk</MenuItem>
                  <MenuItem value="difference">Abszolút különbség</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={toggleSelectAll}
                >
                  {selectedProducts.size === filteredData.length ? 'Kijelölés törlése' : 'Összes kijelölése'}
                </Button>
                {selectedProducts.size > 0 && (
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    onClick={() => handleBulkAction('analyze')}
                  >
                    Elemzés ({selectedProducts.size})
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Drágább termékek ({filteredData.length})
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleBulkAction('export')}
              disabled={selectedProducts.size === 0}
            >
              Exportálás
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedProducts.size > 0 && selectedProducts.size < filteredData.length}
                      checked={selectedProducts.size === filteredData.length && filteredData.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Árunk</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Versenyár</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Különbség</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">% Különbség</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Prioritás</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((item) => {
                  const isSelected = selectedProducts.has(item.linkId)
                  const priority = item.percentDiff > 10 ? 'high' : item.percentDiff > 5 ? 'medium' : 'low'
                  
                  return (
                    <TableRow 
                      key={item.linkId}
                      hover
                      selected={isSelected}
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: item.percentDiff > 10 ? 'error.50' : item.percentDiff > 5 ? 'warning.50' : 'inherit'
                      }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleProductSelection(item.linkId)}
                        />
                      </TableCell>
                      <TableCell onClick={() => handleProductClick(item.productId)}>
                        <Typography variant="body2" fontWeight={500}>
                          {item.sku}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.modelNumber || item.productName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">{item.competitorName}</Typography>
                          <Tooltip title="Megnyitás">
                            <IconButton 
                              size="small" 
                              href={item.competitorUrl}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="right" onClick={() => handleProductClick(item.productId)}>
                        <Typography variant="body2" fontWeight={500}>
                          {formatPrice(item.ourPrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={() => handleProductClick(item.productId)}>
                        <Typography variant="body2">
                          {formatPrice(item.competitorPrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={() => handleProductClick(item.productId)}>
                        <Typography variant="body2" color="error.main" fontWeight={500}>
                          +{formatPrice(item.difference)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={() => handleProductClick(item.productId)}>
                        <Chip
                          label={formatPercent(item.percentDiff)}
                          size="small"
                          color={item.percentDiff > 10 ? 'error' : item.percentDiff > 5 ? 'warning' : 'default'}
                          icon={<TrendingUpIcon />}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={priority === 'high' ? 'Magas' : priority === 'medium' ? 'Közepes' : 'Alacsony'}
                          size="small"
                          color={priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}

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
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Paper,
  Divider,
  Tabs,
  Tab
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  OpenInNew as OpenInNewIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AttachMoney as AttachMoneyIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useState, useMemo, Fragment } from 'react'
import dynamic from 'next/dynamic'
import PriceOptimizer from './PriceOptimizer'
import ExpensiveProductsTab from './ExpensiveProductsTab'

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

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
  priceHistory: Array<{ price: number; scraped_at: string }>
}

interface Metrics {
  totalComparisons: number
  cheaper: number
  moreExpensive: number
  similar: number
  potentialRevenueLoss: number
  avgPriceDiff: number
  freshData: number
  freshDataPercent: number
  staleData: number
  coverage: number
  totalProducts: number
}

interface CompetitorStat {
  id: string
  name: string
  totalProducts: number
  weAreCheaper: number
  weAreExpensive: number
  similar: number
}

interface Props {
  initialData: PriceComparison[]
  metrics: Metrics | null
  competitorStats: CompetitorStat[]
}

export default function CompetitorDashboard({ initialData, metrics, competitorStats }: Props) {
  const router = useRouter()
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'percentDiff' | 'ourPrice' | 'lastChecked'>('percentDiff')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<number>(0)

  // Filter data by competitor
  const filteredData = useMemo(() => {
    let filtered = initialData
    if (selectedCompetitor !== 'all') {
      filtered = filtered.filter(item => item.competitorId === selectedCompetitor)
    }
    return filtered
  }, [initialData, selectedCompetitor])

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    sorted.sort((a, b) => {
      let aVal: number | string | null
      let bVal: number | string | null

      if (sortBy === 'percentDiff') {
        aVal = a.percentDiff
        bVal = b.percentDiff
      } else if (sortBy === 'ourPrice') {
        aVal = a.ourPrice
        bVal = b.ourPrice
      } else {
        aVal = a.lastChecked
        bVal = b.lastChecked
      }

      if (aVal === null) return 1
      if (bVal === null) return -1
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredData, sortBy, sortOrder])

  // Calculate price distribution for chart
  const priceDistribution = useMemo(() => {
    const buckets = {
      '>20% drágább': 0,
      '10-20% drágább': 0,
      '2-10% drágább': 0,
      'Hasonló (±2%)': 0,
      '2-10% olcsóbb': 0,
      '10-20% olcsóbb': 0,
      '>20% olcsóbb': 0
    }

    filteredData.forEach(item => {
      const diff = item.percentDiff
      if (diff > 20) buckets['>20% drágább']++
      else if (diff > 10) buckets['10-20% drágább']++
      else if (diff > 2) buckets['2-10% drágább']++
      else if (diff >= -2) buckets['Hasonló (±2%)']++
      else if (diff > -10) buckets['2-10% olcsóbb']++
      else if (diff > -20) buckets['10-20% olcsóbb']++
      else buckets['>20% olcsóbb']++
    })

    return buckets
  }, [filteredData])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', { 
      style: 'currency', 
      currency: 'HUF',
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatPercent = (percent: number) => {
    const sign = percent > 0 ? '+' : ''
    return `${sign}${percent.toFixed(1)}%`
  }

  const getDaysSinceCheckColor = (days: number | null) => {
    if (days === null) return 'default'
    if (days <= 1) return 'success'
    if (days <= 7) return 'warning'
    return 'error'
  }

  const getDaysSinceCheckLabel = (days: number | null) => {
    if (days === null) return 'Soha'
    if (days === 0) return 'Ma'
    if (days === 1) return '1 nap'
    return `${days} nap`
  }

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  const toggleRow = (linkId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(linkId)) {
      newExpanded.delete(linkId)
    } else {
      newExpanded.add(linkId)
    }
    setExpandedRows(newExpanded)
  }

  // Top 5 where we're most expensive
  const top5Expensive = [...filteredData]
    .filter(p => p.percentDiff > 0)
    .sort((a, b) => b.percentDiff - a.percentDiff)
    .slice(0, 5)

  // Top 5 where we're cheapest
  const top5Cheapest = [...filteredData]
    .filter(p => p.percentDiff < 0)
    .sort((a, b) => a.percentDiff - b.percentDiff)
    .slice(0, 5)

  // Chart options for price distribution
  const distributionChartOptions = {
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
      height: 300
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        distributed: true
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toString()
    },
    xaxis: {
      categories: Object.keys(priceDistribution)
    },
    colors: ['#f44336', '#ff9800', '#ffc107', '#9e9e9e', '#8bc34a', '#4caf50', '#2e7d32'],
    legend: { show: false },
    tooltip: {
      y: {
        formatter: (val: number) => `${val} termék`
      }
    }
  }

  const distributionChartSeries = [{
    name: 'Termékek száma',
    data: Object.values(priceDistribution)
  }]

  if (!metrics) {
    return (
      <Card sx={{ textAlign: 'center', py: 6 }}>
        <InfoIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Nincs árelemzési adat
        </Typography>
      </Card>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Versenytárs Árelemzés
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Áttekintés a versenytársakkal összehasonlított árakról
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Versenytárs szűrés</InputLabel>
            <Select
              value={selectedCompetitor}
              label="Versenytárs szűrés"
              onChange={(e) => setSelectedCompetitor(e.target.value)}
            >
              <MenuItem value="all">Összes versenytárs</MenuItem>
              {competitorStats.map(stat => (
                <MenuItem key={stat.id} value={stat.id}>
                  {stat.name} ({stat.totalProducts})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => router.refresh()}
          >
            Frissítés
          </Button>
        </Box>
      </Box>

      {/* Win Rate Metrics */}
      {metrics.totalComparisons > 0 && (
        <Box sx={{ mb: 3 }}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: 3
          }}>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h2" fontWeight={700} sx={{ color: 'white' }}>
                      {Math.round((metrics.cheaper / metrics.totalComparisons) * 100)}%
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
                      Győzelmi arány
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'rgba(255, 255, 255, 0.9)' }}>
                      {metrics.cheaper} / {metrics.totalComparisons} terméknél nyerünk
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'white' }}>Győzelmek</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                        {metrics.cheaper} ({Math.round((metrics.cheaper / metrics.totalComparisons) * 100)}%)
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={(metrics.cheaper / metrics.totalComparisons) * 100} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5, 
                        mb: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#4caf50'
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'white' }}>Hasonló</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                        {metrics.similar} ({Math.round((metrics.similar / metrics.totalComparisons) * 100)}%)
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={(metrics.similar / metrics.totalComparisons) * 100} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5, 
                        mb: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#ff9800'
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'white' }}>Veszteségek</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                        {metrics.moreExpensive} ({Math.round((metrics.moreExpensive / metrics.totalComparisons) * 100)}%)
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={(metrics.moreExpensive / metrics.totalComparisons) * 100} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#f44336'
                        }
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Áttekintés" />
          <Tab label="Ár Optimalizálás" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Drágább Termékek
                {metrics.moreExpensive > 0 && (
                  <Chip 
                    label={metrics.moreExpensive} 
                    size="small" 
                    color="error"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            } 
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          {/* Enhanced Metrics Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Total Tracked */}
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <InfoIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h3" fontWeight={700} color="info.main">
                    {metrics.totalComparisons}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Összehasonlítás
                  </Typography>
                  {metrics.totalProducts > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={metrics.coverage} 
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {metrics.coverage}% lefedettség
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

        {/* Cheaper */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'success.light', color: 'success.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <TrendingDownIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {metrics.cheaper}
              </Typography>
              <Typography variant="body2">
                Olcsóbbak vagyunk
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}>
                {metrics.totalComparisons > 0 ? Math.round((metrics.cheaper / metrics.totalComparisons) * 100) : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Impact */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'error.light', color: 'error.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <AttachMoneyIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {formatPrice(metrics.potentialRevenueLoss)}
              </Typography>
              <Typography variant="body2">
                Potenciális bevételkiesés
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}>
                {metrics.moreExpensive} terméknél
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Freshness */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: metrics.freshDataPercent >= 80 ? 'success.light' : metrics.freshDataPercent >= 50 ? 'warning.light' : 'error.light' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <ScheduleIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {metrics.freshDataPercent}%
              </Typography>
              <Typography variant="body2">
                Friss adat (24h)
              </Typography>
              {metrics.staleData > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}>
                  {metrics.staleData} elavult
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Price Distribution Chart */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AssessmentIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Árkülönbség eloszlás
                </Typography>
              </Box>
              {filteredData.length > 0 ? (
                <Chart
                  options={distributionChartOptions}
                  series={distributionChartSeries}
                  type="bar"
                  height={300}
                />
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">Nincs adat a megjelenítéshez</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Competitor Statistics */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <InfoIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Versenytárs statisztikák
                </Typography>
              </Box>
              {competitorStats.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {competitorStats.slice(0, 5).map(stat => {
                    const winRate = stat.totalProducts > 0 
                      ? Math.round((stat.weAreCheaper / stat.totalProducts) * 100)
                      : 0
                    return (
                      <Box key={stat.id}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={500}>
                            {stat.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stat.totalProducts} termék
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={winRate} 
                          sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                          color={winRate >= 50 ? 'success' : 'warning'}
                        />
                        <Box sx={{ display: 'flex', gap: 1, fontSize: '0.75rem' }}>
                          <Chip label={`✓ ${stat.weAreCheaper}`} size="small" color="success" />
                          <Chip label={`✗ ${stat.weAreExpensive}`} size="small" color="error" />
                          <Chip label={`≈ ${stat.similar}`} size="small" />
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              ) : (
                <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Nincs versenytárs adat
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top 5 Lists */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Top 5 Most Expensive */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningIcon color="error" />
                <Typography variant="h6" fontWeight={600}>
                  Top 5 - Ahol a legdrágábbak vagyunk
                </Typography>
              </Box>
              
              {top5Expensive.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  🎉 Nincs olyan termék ahol drágábbak lennénk!
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Mi</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Ők</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Különbség</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {top5Expensive.map((item) => (
                        <TableRow 
                          key={item.linkId} 
                          hover 
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleProductClick(item.productId)}
                        >
                          <TableCell>
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
                          <TableCell align="right">
                            <Typography variant="body2">{formatPrice(item.ourPrice)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{formatPrice(item.competitorPrice)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={formatPercent(item.percentDiff)}
                              size="small"
                              color="error"
                              icon={<TrendingUpIcon />}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top 5 Cheapest */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckCircleIcon color="success" />
                <Typography variant="h6" fontWeight={600}>
                  Top 5 - Ahol a legolcsóbbak vagyunk
                </Typography>
              </Box>
              
              {top5Cheapest.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  Nincs adat az olcsóbb termékekről
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Mi</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Ők</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Különbség</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {top5Cheapest.map((item) => (
                        <TableRow 
                          key={item.linkId} 
                          hover 
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleProductClick(item.productId)}
                        >
                          <TableCell>
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
                          <TableCell align="right">
                            <Typography variant="body2">{formatPrice(item.ourPrice)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{formatPrice(item.competitorPrice)}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={formatPercent(item.percentDiff)}
                              size="small"
                              color="success"
                              icon={<TrendingDownIcon />}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* All Products Table with Enhanced Features */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Összes termék összehasonlítás
            </Typography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Rendezés</InputLabel>
              <Select
                value={sortBy}
                label="Rendezés"
                onChange={(e) => {
                  setSortBy(e.target.value as typeof sortBy)
                  if (e.target.value === 'lastChecked') {
                    setSortOrder('desc')
                  }
                }}
              >
                <MenuItem value="percentDiff">Árkülönbség</MenuItem>
                <MenuItem value="ourPrice">Árunk</MenuItem>
                <MenuItem value="lastChecked">Utolsó ellenőrzés</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {sortedData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Nincs megjeleníthető adat
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 50 }}></TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Árunk</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Versenyár</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Különbség</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Utolsó ellenőrzés</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Készlet</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedData.map((item) => {
                    const isExpanded = expandedRows.has(item.linkId)
                    const hasHistory = item.priceHistory.length > 1
                    
                    return (
                      <Fragment key={item.linkId}>
                        <TableRow 
                          hover 
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            {hasHistory && (
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleRow(item.linkId)
                                }}
                              >
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            )}
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
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 60,
                                  height: 8,
                                  bgcolor: item.percentDiff > 0 ? 'error.light' : item.percentDiff < 0 ? 'success.light' : 'grey.300',
                                  borderRadius: 1,
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: item.percentDiff > 0 ? '50%' : '50%',
                                    width: Math.abs(item.percentDiff) * 2,
                                    height: '100%',
                                    bgcolor: item.percentDiff > 0 ? 'error.main' : 'success.main',
                                    transform: item.percentDiff > 0 ? 'translateX(0)' : 'translateX(-100%)'
                                  }}
                                />
                              </Box>
                              <Chip 
                                label={formatPercent(item.percentDiff)}
                                size="small"
                                color={item.percentDiff > 2 ? 'error' : item.percentDiff < -2 ? 'success' : 'default'}
                                icon={item.percentDiff > 0 ? <TrendingUpIcon /> : item.percentDiff < 0 ? <TrendingDownIcon /> : <TrendingFlatIcon />}
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getDaysSinceCheckLabel(item.daysSinceCheck)}
                              size="small"
                              color={getDaysSinceCheckColor(item.daysSinceCheck)}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {item.inStock !== null && (
                              <Chip
                                label={item.inStock ? 'Raktáron' : 'Nincs'}
                                size="small"
                                color={item.inStock ? 'success' : 'default'}
                                icon={item.inStock ? <InventoryIcon /> : undefined}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && hasHistory && (
                          <TableRow>
                            <TableCell colSpan={8} sx={{ py: 2, bgcolor: 'grey.50' }}>
                              <Box sx={{ pl: 4 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Ártörténet (utolsó 30 nap)
                                </Typography>
                                {item.priceHistory.length > 0 ? (
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                    {item.priceHistory.slice(-10).map((history) => (
                                      <Chip
                                        key={`${item.linkId}-${history.scraped_at}`}
                                        label={`${formatPrice(history.price)} (${new Date(history.scraped_at).toLocaleDateString('hu-HU')})`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Nincs elérhető ártörténet
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === 1 && (
        <PriceOptimizer priceComparisons={filteredData} />
      )}

      {activeTab === 2 && (
        <ExpensiveProductsTab priceComparisons={filteredData} />
      )}
    </Box>
  )
}

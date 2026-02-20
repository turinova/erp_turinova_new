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
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Button
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  OpenInNew as OpenInNewIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'

interface PriceComparison {
  linkId: string
  productId: string
  sku: string
  productName: string | null
  modelNumber: string | null
  ourPrice: number
  competitorName: string
  competitorPrice: number
  difference: number
  percentDiff: number
  lastChecked: string | null
  competitorUrl: string
}

interface Props {
  initialData: PriceComparison[]
}

export default function CompetitorDashboard({ initialData }: Props) {
  const router = useRouter()
  
  // Calculate metrics
  const total = initialData.length
  const cheaper = initialData.filter(p => p.percentDiff < -2).length  // We're cheaper (negative diff means our price is lower)
  const moreExpensive = initialData.filter(p => p.percentDiff > 2).length  // We're more expensive
  const similar = initialData.filter(p => p.percentDiff >= -2 && p.percentDiff <= 2).length  // Within 2%
  
  const cheaperPercent = total > 0 ? Math.round((cheaper / total) * 100) : 0
  const moreExpensivePercent = total > 0 ? Math.round((moreExpensive / total) * 100) : 0
  const similarPercent = total > 0 ? Math.round((similar / total) * 100) : 0

  // Top 5 where we're most expensive (highest positive percentDiff)
  const top5Expensive = [...initialData]
    .filter(p => p.percentDiff > 0)
    .sort((a, b) => b.percentDiff - a.percentDiff)
    .slice(0, 5)

  // Top 5 where we're cheapest (most negative percentDiff - best deals)
  const top5Cheapest = [...initialData]
    .filter(p => p.percentDiff < 0)
    .sort((a, b) => a.percentDiff - b.percentDiff)
    .slice(0, 5)

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

  const handleProductClick = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Versenytárs Árelemzés
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Áttekintés a versenytársakkal összehasonlított árakról
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => router.refresh()}
        >
          Frissítés
        </Button>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Tracked */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <InfoIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h3" fontWeight={700} color="info.main">
                {total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Összehasonlítás
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Cheaper */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'success.light', color: 'success.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <TrendingDownIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {cheaper}
              </Typography>
              <Typography variant="body2">
                Olcsóbbak vagyunk ({cheaperPercent}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Similar */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'grey.200' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <TrendingFlatIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="h3" fontWeight={700} color="text.primary">
                {similar}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hasonló ár ({similarPercent}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* More Expensive */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', bgcolor: 'error.light', color: 'error.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <TrendingUpIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h3" fontWeight={700}>
                {moreExpensive}
              </Typography>
              <Typography variant="body2">
                Drágábbak vagyunk ({moreExpensivePercent}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Two Column Layout for Top Lists */}
      <Grid container spacing={3}>
        {/* Top 5 Most Expensive (Problem Products) */}
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

        {/* Top 5 Cheapest (Good Products) */}
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

      {/* No Data State */}
      {total === 0 && (
        <Card sx={{ mt: 3, textAlign: 'center', py: 6 }}>
          <InfoIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nincs árelemzési adat
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Adjon hozzá versenytárs linkeket a termékekhez, majd kattintson az "Ár ellenőrzése" gombra.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => router.push('/competitors/links')}
          >
            Linkek kezelése
          </Button>
        </Card>
      )}
    </Box>
  )
}

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
  Button,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  LinearProgress
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AttachMoney as AttachMoneyIcon,
  Lightbulb as LightbulbIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

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
  daysSinceCheck: number | null
  competitorUrl: string
  inStock: boolean | null
}

interface PriceRecommendation {
  linkId: string
  productId: string
  sku: string
  productName: string | null
  modelNumber: string | null
  currentPrice: number
  competitorPrice: number
  currentPercentDiff: number
  recommendedPrice: number
  priceChange: number
  priceChangePercent: number
  recommendationType: 'increase' | 'decrease' | 'maintain'
  impact: 'win' | 'still_win' | 'flip_to_win' | 'maintain'
  revenueImpact: number
  priority: 'high' | 'medium' | 'low'
  reason: string
}

interface Props {
  priceComparisons: PriceComparison[]
}

export default function PriceOptimizer({ priceComparisons }: Props) {
  const router = useRouter()

  // Calculate price recommendations
  const recommendations = useMemo(() => {
    const recs: PriceRecommendation[] = []

    priceComparisons.forEach(item => {
      const { linkId, ourPrice, competitorPrice, percentDiff, productId, sku, productName, modelNumber, inStock } = item
      
      // Quick wins: Products losing by 2-5% (easy fix)
      if (percentDiff > 2 && percentDiff <= 5) {
        const recommendedPrice = Math.round(competitorPrice * 0.98) // 2% below competitor
        const priceChange = recommendedPrice - ourPrice
        const priceChangePercent = ((priceChange / ourPrice) * 100)
        
        recs.push({
          linkId,
          productId,
          sku,
          productName,
          modelNumber,
          currentPrice: ourPrice,
          competitorPrice,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: priceChange, // Negative (revenue loss per unit)
          priority: 'high',
          reason: `Losing by ${percentDiff.toFixed(1)}% - Small reduction will flip to win`
        })
      }
      
      // Safe increases: Products winning by 10%+ (can increase safely)
      if (percentDiff < -10) {
        const recommendedPrice = Math.round(competitorPrice * 0.95) // Still 5% below competitor
        const priceChange = recommendedPrice - ourPrice
        const priceChangePercent = ((priceChange / ourPrice) * 100)
        
        if (priceChange > 0) { // Only if it's an increase
          recs.push({
            linkId,
            productId,
            sku,
            productName,
            modelNumber,
            currentPrice: ourPrice,
            competitorPrice,
            currentPercentDiff: percentDiff,
            recommendedPrice,
            priceChange,
            priceChangePercent,
            recommendationType: 'increase',
            impact: 'still_win',
            revenueImpact: priceChange, // Positive (revenue gain per unit)
            priority: 'medium',
            reason: `Winning by ${Math.abs(percentDiff).toFixed(1)}% - Safe to increase while staying competitive`
          })
        }
      }
      
      // Moderate fixes: Products losing by 5-10% (moderate reduction needed)
      if (percentDiff > 5 && percentDiff <= 10) {
        const recommendedPrice = Math.round(competitorPrice * 0.97) // 3% below competitor
        const priceChange = recommendedPrice - ourPrice
        const priceChangePercent = ((priceChange / ourPrice) * 100)
        
        recs.push({
          linkId,
          productId,
          sku,
          productName,
          modelNumber,
          currentPrice: ourPrice,
          competitorPrice,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: priceChange,
          priority: 'high',
          reason: `Losing by ${percentDiff.toFixed(1)}% - Moderate reduction needed to win`
        })
      }
      
      // Opportunity: Competitor out of stock (can increase price)
      if (inStock === false && percentDiff < 0) {
        const recommendedPrice = Math.round(ourPrice * 1.05) // 5% increase
        const priceChange = recommendedPrice - ourPrice
        const priceChangePercent = ((priceChange / ourPrice) * 100)
        
        recs.push({
          linkId,
          productId,
          sku,
          productName,
          modelNumber,
          currentPrice: ourPrice,
          competitorPrice,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'increase',
          impact: 'still_win',
          revenueImpact: priceChange,
          priority: 'medium',
          reason: 'Competitor out of stock - Opportunity to increase price'
        })
      }
    })

    // Sort by priority and impact
    recs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      // Within same priority, sort by absolute revenue impact
      return Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact)
    })

    return recs
  }, [priceComparisons])

  // Calculate revenue impact summary
  const revenueImpact = useMemo(() => {
    const increases = recommendations.filter(r => r.recommendationType === 'increase')
    const decreases = recommendations.filter(r => r.recommendationType === 'decrease')
    
    const totalGain = increases.reduce((sum, r) => sum + r.revenueImpact, 0)
    const totalLoss = decreases.reduce((sum, r) => sum + Math.abs(r.revenueImpact), 0)
    const netGain = totalGain - totalLoss
    
    return {
      totalGain,
      totalLoss,
      netGain,
      increaseCount: increases.length,
      decreaseCount: decreases.length
    }
  }, [recommendations])

  // Quick wins (high priority, easy fixes)
  const quickWins = recommendations.filter(r => r.priority === 'high' && r.recommendationType === 'decrease')
  
  // Safe increases
  const safeIncreases = recommendations.filter(r => r.recommendationType === 'increase')

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

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Nincs ár optimalizálási javaslat
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Az árak jelenleg optimálisak a versenytársakhoz képest
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Quick Wins */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LightbulbIcon />
                <Typography variant="h6" fontWeight={600}>
                  Gyors győzelmek
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700}>
                {quickWins.length}
              </Typography>
              <Typography variant="body2">
                Könnyen javítható termékek
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.9 }}>
                Átlagos ár csökkentés: {quickWins.length > 0 
                  ? formatPrice(Math.round(quickWins.reduce((sum, r) => sum + Math.abs(r.priceChange), 0) / quickWins.length))
                  : '0 Ft'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Safe Increases */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon />
                <Typography variant="h6" fontWeight={600}>
                  Biztonságos emelések
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700}>
                {safeIncreases.length}
              </Typography>
              <Typography variant="body2">
                Ár emelhető, még mindig nyerünk
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.9 }}>
                Potenciális bevétel: {formatPrice(revenueImpact.totalGain)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Net Revenue Impact */}
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: revenueImpact.netGain > 0 ? 'info.light' : 'error.light' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AttachMoneyIcon />
                <Typography variant="h6" fontWeight={600}>
                  Nettó bevétel hatás
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700}>
                {formatPrice(revenueImpact.netGain)}
              </Typography>
              <Typography variant="body2">
                {revenueImpact.netGain > 0 ? 'Havi potenciális nyereség' : 'Havi potenciális veszteség'}
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1, fontSize: '0.75rem' }}>
                <Chip label={`+${formatPrice(revenueImpact.totalGain)}`} size="small" color="success" />
                <Chip label={`-${formatPrice(revenueImpact.totalLoss)}`} size="small" color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Wins Alert */}
      {quickWins.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Gyors győzelmek elérhetők!</AlertTitle>
          <Typography variant="body2">
            {quickWins.length} terméknél kis ár csökkentéssel ({formatPrice(Math.round(quickWins.reduce((sum, r) => sum + Math.abs(r.priceChange), 0) / quickWins.length))} átlag) 
            győzhetünk a versenytársakkal szemben.
          </Typography>
        </Alert>
      )}

      {/* Recommendations Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Ár optimalizálási javaslatok
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                // TODO: Implement bulk apply
                alert('Bulk apply functionality coming soon')
              }}
            >
              Összes alkalmazása
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Jelenlegi ár</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Versenyár</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Különbség</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Javasolt ár</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Változás</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Hatás</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Bevétel hatás</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Indok</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations.map((rec, index) => (
                  <TableRow 
                    key={`${rec.linkId}-${rec.recommendationType}-${index}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleProductClick(rec.productId)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {rec.sku}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rec.modelNumber || rec.productName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
                        {formatPrice(rec.currentPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatPrice(rec.competitorPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercent(rec.currentPercentDiff)}
                        size="small"
                        color={rec.currentPercentDiff > 0 ? 'error' : 'success'}
                        icon={rec.currentPercentDiff > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color={rec.recommendationType === 'increase' ? 'success.main' : 'error.main'}>
                        {formatPrice(rec.recommendedPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {rec.recommendationType === 'increase' ? (
                          <ArrowUpwardIcon fontSize="small" color="success" />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" color="error" />
                        )}
                        <Typography 
                          variant="body2" 
                          color={rec.recommendationType === 'increase' ? 'success.main' : 'error.main'}
                          fontWeight={500}
                        >
                          {formatPercent(rec.priceChangePercent)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={
                          rec.impact === 'flip_to_win' ? 'Győzelem' :
                          rec.impact === 'still_win' ? 'Még nyerünk' :
                          rec.impact === 'win' ? 'Nyerünk' : 'Fenntart'
                        }
                        size="small"
                        color={
                          rec.impact === 'flip_to_win' ? 'success' :
                          rec.impact === 'still_win' ? 'success' :
                          rec.impact === 'win' ? 'success' : 'default'
                        }
                        icon={<CheckCircleIcon />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        fontWeight={500}
                        color={rec.revenueImpact > 0 ? 'success.main' : 'error.main'}
                      >
                        {formatPrice(rec.revenueImpact)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={rec.reason}>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, display: 'block' }}>
                          {rec.reason}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}

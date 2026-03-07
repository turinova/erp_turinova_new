'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  InputAdornment,
  Skeleton,
  Grid,
  Collapse
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  TrendingFlat as TrendingFlatIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Store as StoreIcon,
  Search as SearchIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  AttachMoney as AttachMoneyIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Competitor {
  id: string
  name: string
  website_url: string
  is_active: boolean
}

interface CompetitorPrice {
  id: string
  price: number | null
  price_gross: number | null
  price_type: 'gross' | 'net' | 'unknown'
  vat_rate: number
  original_price: number | null
  currency: string
  in_stock: boolean | null
  scraped_at: string
}

interface CompetitorLink {
  id: string
  product_id: string
  competitor_id: string
  competitor_url: string
  competitor_sku: string | null
  competitor_product_name: string | null
  matching_method: string
  is_active: boolean
  last_checked_at: string | null
  last_error: string | null
  competitor: Competitor
  latestPrice: CompetitorPrice | null
  prices: CompetitorPrice[]
}

interface PriceRecommendation {
  linkId: string
  productId: string
  sku: string
  productName: string | null
  modelNumber: string | null
  currentPrice: number
  competitorPrice: number
  competitorName: string
  currentPercentDiff: number
  recommendedPrice: number
  priceChange: number
  priceChangePercent: number
  recommendationType: 'increase' | 'decrease' | 'maintain'
  impact: 'win' | 'still_win' | 'flip_to_win' | 'maintain'
  revenueImpact: number
  priority: 'high' | 'medium' | 'low'
  reason: string
  margin?: number
  marginPercent?: number
  minPrice?: number
}

interface Props {
  productId: string
  productPrice: number | null
  productCost: number | null
  productName: string | null
  modelNumber: string | null
  isVisible?: boolean // Only load data when component is visible
  onPriceUpdate?: (newPrice: number) => void
}

export default function AIPricingRecommendationsCard({ 
  productId, 
  productPrice, 
  productCost,
  productName, 
  modelNumber,
  isVisible = true,
  onPriceUpdate
}: Props) {
  const [links, setLinks] = useState<CompetitorLink[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null)
  
  // Add/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<CompetitorLink | null>(null)
  const [formData, setFormData] = useState({
    competitor_id: '',
    competitor_url: '',
    competitor_sku: '',
    competitor_product_name: ''
  })
  const [saving, setSaving] = useState(false)
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<CompetitorLink | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Scraping state
  const [scrapingLinkId, setScrapingLinkId] = useState<string | null>(null)

  // Price apply confirmation
  const [applyPriceDialogOpen, setApplyPriceDialogOpen] = useState(false)
  const [priceToApply, setPriceToApply] = useState<PriceRecommendation | null>(null)

  // Competitor prices section collapsed state
  const [competitorPricesExpanded, setCompetitorPricesExpanded] = useState(false)

  // Load competitor links
  const loadLinks = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/competitor-links`)
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
      }
    } catch (err) {
      console.error('Error loading competitor links:', err)
      setError('Hiba a versenytárs linkek betöltésekor')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // Load all competitors
  const loadCompetitors = useCallback(async () => {
    try {
      const response = await fetch('/api/competitors')
      if (response.ok) {
        const data = await response.json()
        setCompetitors(data)
      }
    } catch (err) {
      console.error('Error loading competitors:', err)
    }
  }, [])

  useEffect(() => {
    // Only load data when component is visible
    if (isVisible) {
      loadLinks()
      loadCompetitors()
    }
  }, [loadLinks, loadCompetitors, isVisible])

  // Calculate AI recommendations
  const recommendations = useMemo(() => {
    if (!productPrice || links.length === 0) return []

    const recs: PriceRecommendation[] = []

    // Find the cheapest competitor
    const competitorsWithPrices = links
      .filter(link => link.latestPrice?.price && link.is_active)
      .map(link => ({
        linkId: link.id,
        competitorName: link.competitor.name,
        competitorPrice: link.latestPrice!.price!,
        inStock: link.latestPrice!.in_stock
      }))

    if (competitorsWithPrices.length === 0) return []

    const cheapest = competitorsWithPrices.reduce((cheapest, current) => {
      return current.competitorPrice < cheapest.competitorPrice ? current : cheapest
    })

    const percentDiff = ((productPrice - cheapest.competitorPrice) / cheapest.competitorPrice) * 100

    // Calculate margin if cost is available
    const calculateMargin = (price: number) => {
      if (!productCost || productCost <= 0) return null
      const margin = price - productCost
      const marginPercent = (margin / price) * 100
      return { margin, marginPercent }
    }

    // Minimum price based on cost + 5% margin (if cost available)
    const minPrice = productCost && productCost > 0 
      ? Math.round(productCost * 1.05)
      : null

    // Quick wins: Products losing by 2-5% to cheapest competitor
    if (percentDiff > 2 && percentDiff <= 5) {
      const recommendedPrice = Math.round(cheapest.competitorPrice * 0.98)
      const priceChange = recommendedPrice - productPrice
      const priceChangePercent = ((priceChange / productPrice) * 100)
      const margin = calculateMargin(recommendedPrice)

      // Check if recommendation violates minimum margin
      if (minPrice && recommendedPrice < minPrice) {
        // Use minimum price instead
        const adjustedPrice = minPrice
        const adjustedChange = adjustedPrice - productPrice
        const adjustedChangePercent = ((adjustedChange / productPrice) * 100)
        const adjustedMargin = calculateMargin(adjustedPrice)

        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice: adjustedPrice,
          priceChange: adjustedChange,
          priceChangePercent: adjustedChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: adjustedChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk, de az ajánlott ár alacsonyabb lenne a minimum árnál (${minPrice} Ft). Minimum ár alkalmazva.`,
          margin: adjustedMargin?.margin || null,
          marginPercent: adjustedMargin?.marginPercent || null,
          minPrice
        })
      } else {
        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: priceChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk a legolcsóbb versenytárshoz képest (${cheapest.competitorName}) - Kis csökkentéssel győzhetünk`,
          margin: margin?.margin || null,
          marginPercent: margin?.marginPercent || null,
          minPrice
        })
      }
    }

    // Safe increases: Products winning by 10%+ against cheapest competitor
    if (percentDiff < -10) {
      const recommendedPrice = Math.round(cheapest.competitorPrice * 0.95)
      const priceChange = recommendedPrice - productPrice
      const priceChangePercent = ((priceChange / productPrice) * 100)

      if (priceChange > 0) {
        const margin = calculateMargin(recommendedPrice)
        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'increase',
          impact: 'still_win',
          revenueImpact: priceChange,
          priority: 'medium',
          reason: `${Math.abs(percentDiff).toFixed(1)}%-kal olcsóbbak vagyunk a legolcsóbb versenytárshoz képest (${cheapest.competitorName}) - Biztonságosan emelhetjük az árat`,
          margin: margin?.margin || null,
          marginPercent: margin?.marginPercent || null,
          minPrice
        })
      }
    }

    // Moderate fixes: Products losing by 5-10%
    if (percentDiff > 5 && percentDiff <= 10) {
      const recommendedPrice = Math.round(cheapest.competitorPrice * 0.97)
      const priceChange = recommendedPrice - productPrice
      const priceChangePercent = ((priceChange / productPrice) * 100)
      const margin = calculateMargin(recommendedPrice)

      if (minPrice && recommendedPrice < minPrice) {
        const adjustedPrice = minPrice
        const adjustedChange = adjustedPrice - productPrice
        const adjustedChangePercent = ((adjustedChange / productPrice) * 100)
        const adjustedMargin = calculateMargin(adjustedPrice)

        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice: adjustedPrice,
          priceChange: adjustedChange,
          priceChangePercent: adjustedChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: adjustedChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk, de az ajánlott ár alacsonyabb lenne a minimum árnál. Minimum ár alkalmazva.`,
          margin: adjustedMargin?.margin || null,
          marginPercent: adjustedMargin?.marginPercent || null,
          minPrice
        })
      } else {
        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: priceChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk a legolcsóbb versenytárshoz képest (${cheapest.competitorName}) - Mérsékelt csökkentés szükséges`,
          margin: margin?.margin || null,
          marginPercent: margin?.marginPercent || null,
          minPrice
        })
      }
    }

    // Large gaps: Products losing by >10%
    if (percentDiff > 10) {
      const recommendedPrice = Math.round(cheapest.competitorPrice * 0.98)
      const priceChange = recommendedPrice - productPrice
      const priceChangePercent = ((priceChange / productPrice) * 100)
      const margin = calculateMargin(recommendedPrice)

      if (minPrice && recommendedPrice < minPrice) {
        const adjustedPrice = minPrice
        const adjustedChange = adjustedPrice - productPrice
        const adjustedChangePercent = ((adjustedChange / productPrice) * 100)
        const adjustedMargin = calculateMargin(adjustedPrice)

        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice: adjustedPrice,
          priceChange: adjustedChange,
          priceChangePercent: adjustedChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: adjustedChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk, de az ajánlott ár alacsonyabb lenne a minimum árnál. Minimum ár alkalmazva.`,
          margin: adjustedMargin?.margin || null,
          marginPercent: adjustedMargin?.marginPercent || null,
          minPrice
        })
      } else {
        recs.push({
          linkId: cheapest.linkId,
          productId,
          sku: productName || '',
          productName,
          modelNumber,
          currentPrice: productPrice,
          competitorPrice: cheapest.competitorPrice,
          competitorName: cheapest.competitorName,
          currentPercentDiff: percentDiff,
          recommendedPrice,
          priceChange,
          priceChangePercent,
          recommendationType: 'decrease',
          impact: 'flip_to_win',
          revenueImpact: priceChange,
          priority: 'high',
          reason: `${percentDiff.toFixed(1)}%-kal drágábbak vagyunk a legolcsóbb versenytárshoz képest (${cheapest.competitorName}) - Jelentős csökkentés szükséges`,
          margin: margin?.margin || null,
          marginPercent: margin?.marginPercent || null,
          minPrice
        })
      }
    }

    // Opportunity: Cheapest competitor out of stock
    if (cheapest.inStock === false && percentDiff < 0) {
      const recommendedPrice = Math.round(productPrice * 1.05)
      const priceChange = recommendedPrice - productPrice
      const priceChangePercent = ((priceChange / productPrice) * 100)
      const margin = calculateMargin(recommendedPrice)

      recs.push({
        linkId: cheapest.linkId,
        productId,
        sku: productName || '',
        productName,
        modelNumber,
        currentPrice: productPrice,
        competitorPrice: cheapest.competitorPrice,
        competitorName: cheapest.competitorName,
        currentPercentDiff: percentDiff,
        recommendedPrice,
        priceChange,
        priceChangePercent,
        recommendationType: 'increase',
        impact: 'still_win',
        revenueImpact: priceChange,
        priority: 'medium',
        reason: `Legolcsóbb versenytárs (${cheapest.competitorName}) nincs raktáron - Lehetőség az ár emelésére`,
        margin: margin?.margin || null,
        marginPercent: margin?.marginPercent || null,
        minPrice
      })
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    recs.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }
      return Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact)
    })

    return recs
  }, [productPrice, productCost, links, productId, productName, modelNumber])

  const handleOpenDialog = (link?: CompetitorLink) => {
    if (link) {
      setEditingLink(link)
      setFormData({
        competitor_id: link.competitor_id,
        competitor_url: link.competitor_url,
        competitor_sku: link.competitor_sku || '',
        competitor_product_name: link.competitor_product_name || ''
      })
    } else {
      setEditingLink(null)
      setFormData({
        competitor_id: competitors[0]?.id || '',
        competitor_url: '',
        competitor_sku: modelNumber || '',
        competitor_product_name: ''
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingLink(null)
    setFormData({
      competitor_id: '',
      competitor_url: '',
      competitor_sku: '',
      competitor_product_name: ''
    })
  }

  const handleSave = async () => {
    if (!formData.competitor_id || !formData.competitor_url) {
      return
    }

    setSaving(true)

    try {
      const url = editingLink
        ? `/api/products/${productId}/competitor-links/${editingLink.id}`
        : `/api/products/${productId}/competitor-links`
      
      const method = editingLink ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Hiba a mentés során')
      }

      handleCloseDialog()
      loadLinks()
      toast.success(editingLink ? 'Versenytárs link frissítve' : 'Versenytárs link hozzáadva')
    } catch (err: any) {
      toast.error(err.message)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!linkToDelete) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/products/${productId}/competitor-links/${linkToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Hiba a törlés során')
      }

      setDeleteDialogOpen(false)
      setLinkToDelete(null)
      loadLinks()
      toast.success('Versenytárs link törölve')
    } catch (err: any) {
      toast.error(err.message)
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // Scrape competitor price with AI
  const handleScrapePrice = async (link: CompetitorLink) => {
    setScrapingLinkId(link.id)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}/competitor-links/${link.id}/scrape`, {
        method: 'POST'
      })

      const result = await response.json()

      if (response.status === 402) {
        const credits = result.credits || {}
        toast.error(
          `Nincs elég credit az ár ellenőrzéshez! Szükséges: ${credits.required || '?'}, Elérhető: ${credits.available || 0} / ${credits.limit || '?'}`,
          { autoClose: 6000 }
        )
        return
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Hiba az ár ellenőrzése során')
      }

      window.dispatchEvent(new Event('creditUsageUpdated'))

      const grossText = result.scrapeResult.priceGross 
        ? `Bruttó: ${new Intl.NumberFormat('hu-HU').format(result.scrapeResult.priceGross)} Ft`
        : ''
      const netText = result.scrapeResult.price 
        ? `Nettó: ${new Intl.NumberFormat('hu-HU').format(result.scrapeResult.price)} Ft`
        : 'Nem sikerült kiolvasni az árat'
      
      toast.success(
        `${link.competitor.name}: ${grossText ? grossText + ' → ' : ''}${netText}` + 
        (result.scrapeResult.confidence ? ` (${result.scrapeResult.confidence}% bizonyosság)` : ''),
        { autoClose: 5000 }
      )

      loadLinks()
    } catch (err: any) {
      toast.error(`Hiba: ${err.message}`)
      setError(err.message)
    } finally {
      setScrapingLinkId(null)
    }
  }

  // Apply recommended price
  const handleApplyPrice = async (recommendation: PriceRecommendation) => {
    setPriceToApply(recommendation)
    setApplyPriceDialogOpen(true)
  }

  const confirmApplyPrice = async () => {
    if (!priceToApply || !onPriceUpdate) return

    setApplyingPrice(priceToApply.linkId)

    try {
      // Update the product price via callback
      onPriceUpdate(priceToApply.recommendedPrice)
      
      toast.success(`Ár frissítve: ${new Intl.NumberFormat('hu-HU').format(priceToApply.recommendedPrice)} Ft`)
      setApplyPriceDialogOpen(false)
      setPriceToApply(null)
    } catch (err: any) {
      toast.error(`Hiba az ár frissítésekor: ${err.message}`)
    } finally {
      setApplyingPrice(null)
    }
  }

  const formatPrice = (price: number | null | undefined, currency: string = 'HUF'): string => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency }).format(price)
  }

  const formatPercent = (percent: number) => {
    const sign = percent > 0 ? '+' : ''
    return `${sign}${percent.toFixed(1)}%`
  }

  const getPriceDifference = (competitorPrice: number | null): { diff: number; percent: number; direction: 'up' | 'down' | 'same' } | null => {
    if (!productPrice || !competitorPrice) return null
    
    const diff = productPrice - competitorPrice
    const percent = ((diff / competitorPrice) * 100)
    
    return {
      diff,
      percent,
      direction: diff > 10 ? 'up' : diff < -10 ? 'down' : 'same'
    }
  }

  const getPriceComparisonColor = (direction: 'up' | 'down' | 'same') => {
    switch (direction) {
      case 'up': return 'error.main'
      case 'down': return 'success.main'
      default: return 'text.secondary'
    }
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    )
  }

  const availableCompetitors = competitors.filter(
    c => !links.some(l => l.competitor_id === c.id)
  )

  const quickWins = recommendations.filter(r => r.priority === 'high' && r.recommendationType === 'decrease')
  const safeIncreases = recommendations.filter(r => r.recommendationType === 'increase')

  // Get the best recommendation (highest priority)
  const bestRecommendation = recommendations.length > 0 ? recommendations[0] : null

  return (
    <Box>
      {/* AI Recommendations Section - Redesigned */}
      {bestRecommendation ? (
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3,
            p: 2.5,
            bgcolor: 'white',
            border: '1px solid',
            borderColor: 'rgba(0, 0, 0, 0.08)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                p: 0.75,
                borderRadius: '8px',
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AutoAwesomeIcon 
                  sx={{ 
                    fontSize: 18, 
                    color: 'rgba(0, 0, 0, 0.7)'
                  }} 
                />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: 'rgba(0, 0, 0, 0.9)', letterSpacing: '-0.01em' }}>
                AI Ajánlás
              </Typography>
            </Box>
            <Chip
              label={bestRecommendation.recommendationType === 'increase' ? 'Ár emelés' : 'Ár csökkentés'}
              size="small"
              sx={{
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                color: 'rgba(0, 0, 0, 0.7)',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.75rem',
                height: '24px'
              }}
              icon={bestRecommendation.recommendationType === 'increase' ? (
                <TrendingUpIcon sx={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.6)' }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.6)' }} />
              )}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* Current Price - Neutral Gray */}
            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: 'rgba(0, 0, 0, 0.02)', 
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                position: 'relative',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                  bgcolor: 'rgba(0, 0, 0, 0.03)'
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    p: 0.5,
                    borderRadius: '6px',
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AttachMoneyIcon sx={{ fontSize: 16, color: 'rgba(0, 0, 0, 0.6)' }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Jelenlegi ár
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={700} sx={{ fontSize: '1.5rem', color: 'rgba(0, 0, 0, 0.9)', mb: 0.5, letterSpacing: '-0.02em' }}>
                  {formatPrice(bestRecommendation.currentPrice)}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'rgba(0, 0, 0, 0.5)' }}>
                  Nettó ár
                </Typography>
              </Box>
            </Grid>
            
            {/* Competitor Price - Neutral Gray */}
            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: 'rgba(0, 0, 0, 0.02)', 
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                position: 'relative',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                  bgcolor: 'rgba(0, 0, 0, 0.03)'
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    p: 0.5,
                    borderRadius: '6px',
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <StoreIcon sx={{ fontSize: 16, color: 'rgba(0, 0, 0, 0.6)' }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Versenyár
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.7rem', fontWeight: 500, color: 'rgba(0, 0, 0, 0.6)' }}>
                  {bestRecommendation.competitorName}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ fontSize: '1.5rem', color: 'rgba(0, 0, 0, 0.9)', mb: 0.5, letterSpacing: '-0.02em' }}>
                  {formatPrice(bestRecommendation.competitorPrice)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={formatPercent(bestRecommendation.currentPercentDiff)}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: bestRecommendation.currentPercentDiff > 0 
                        ? 'rgba(244, 67, 54, 0.08)' 
                        : 'rgba(76, 175, 80, 0.08)',
                      color: bestRecommendation.currentPercentDiff > 0 
                        ? '#D32F2F' 
                        : '#388E3C',
                      border: 'none',
                      borderRadius: '4px'
                    }}
                  />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'rgba(0, 0, 0, 0.5)' }}>
                    Nettó ár
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            {/* Recommended Price - Subtle Blue Accent */}
            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: 'rgba(33, 150, 243, 0.04)', 
                borderRadius: 1.5,
                border: '2px solid',
                borderColor: 'rgba(33, 150, 243, 0.2)',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(33, 150, 243, 0.3)',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.12)'
                }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    p: 0.5,
                    borderRadius: '6px',
                    bgcolor: 'rgba(33, 150, 243, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <LightbulbIcon sx={{ 
                      fontSize: 16, 
                      color: '#2196F3'
                    }} />
                  </Box>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600, 
                    color: '#1976D2',
                    fontSize: '0.75rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px' 
                  }}>
                    Ajánlott ár
                  </Typography>
                </Box>
                <Typography 
                  variant="h5" 
                  fontWeight={700}
                  sx={{ 
                    fontSize: '1.75rem',
                    color: '#1976D2',
                    mb: 0.5,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {formatPrice(bestRecommendation.recommendedPrice)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {bestRecommendation.recommendationType === 'increase' ? (
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#2196F3' }} />
                  ) : (
                    <ArrowDownwardIcon sx={{ fontSize: 16, color: '#2196F3' }} />
                  )}
                  <Typography 
                    variant="body2"
                    sx={{
                      color: '#1976D2',
                      fontWeight: 600,
                      fontSize: '0.75rem'
                    }}
                  >
                    {formatPercent(bestRecommendation.priceChangePercent)}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'rgba(0, 0, 0, 0.5)' }}>
                  Nettó ár
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {productCost && productCost > 0 && bestRecommendation.margin !== null && (
            <Box sx={{ 
              mb: 2, 
              p: 1.5, 
              bgcolor: 'rgba(0, 0, 0, 0.02)', 
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'rgba(0, 0, 0, 0.08)'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.875rem' }}>
                  Árrés az ajánlott áron:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="body2" 
                    fontWeight={700}
                    sx={{
                      color: bestRecommendation.margin < 0 
                        ? '#D32F2F' 
                        : bestRecommendation.marginPercent && bestRecommendation.marginPercent < 10
                        ? '#F57C00'
                        : 'rgba(0, 0, 0, 0.9)',
                      fontSize: '0.875rem'
                    }}
                  >
                    {formatPrice(bestRecommendation.margin)}
                  </Typography>
                  <Chip
                    label={formatPercent(bestRecommendation.marginPercent || 0)}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: bestRecommendation.margin < 0 
                        ? 'rgba(244, 67, 54, 0.08)' 
                        : bestRecommendation.marginPercent && bestRecommendation.marginPercent < 10
                        ? 'rgba(255, 152, 0, 0.08)'
                        : 'rgba(76, 175, 80, 0.08)',
                      color: bestRecommendation.margin < 0 
                        ? '#D32F2F' 
                        : bestRecommendation.marginPercent && bestRecommendation.marginPercent < 10
                        ? '#F57C00'
                        : '#388E3C',
                      border: 'none',
                      borderRadius: '4px'
                    }}
                  />
                </Box>
              </Box>
              {bestRecommendation.minPrice && bestRecommendation.recommendedPrice === bestRecommendation.minPrice && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5, 
                  mt: 1, 
                  pt: 1, 
                  borderTop: '1px solid',
                  borderColor: 'rgba(0, 0, 0, 0.08)'
                }}>
                  <WarningIcon sx={{ fontSize: 14, color: '#F57C00' }} />
                  <Typography variant="caption" sx={{ color: '#F57C00', fontWeight: 500, fontSize: '0.7rem' }}>
                    Minimum ár alkalmazva (költség + 5%)
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            gap: 2,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'rgba(0, 0, 0, 0.08)'
          }}>
            <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.6, color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.875rem' }}>
              {bestRecommendation.reason}
            </Typography>
            <Button
              variant="contained"
              size="medium"
              onClick={() => handleApplyPrice(bestRecommendation)}
              disabled={!!applyingPrice}
              startIcon={applyingPrice === bestRecommendation.linkId ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              )}
              sx={{
                bgcolor: '#4CAF50',
                color: 'white',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#388E3C',
                },
                minWidth: 120
              }}
            >
              {applyingPrice === bestRecommendation.linkId ? 'Alkalmazás...' : 'Alkalmaz'}
            </Button>
          </Box>
        </Paper>
      ) : links.length > 0 && productPrice ? (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: 1, 
          mt: 1.5, 
          mb: 2,
          p: 1.5,
          bgcolor: 'rgba(231, 76, 60, 0.08)',
          borderRadius: 1,
          borderLeft: '3px solid #e74c3c'
        }}>
          <InfoIcon sx={{ color: '#c0392b', fontSize: '18px', mt: 0.25, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: '#c0392b', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            Nincs ár optimalizálási javaslat. Az árak jelenleg versenyképesek.
          </Typography>
        </Box>
      ) : null}

      {/* Competitor Prices Section - Collapsible */}
      <Card 
        variant="outlined"
        sx={{
          border: '1px solid',
          borderColor: 'rgba(0, 0, 0, 0.12)',
          bgcolor: 'rgba(0, 0, 0, 0.02)',
          '&:hover': {
            borderColor: 'rgba(0, 0, 0, 0.2)',
            bgcolor: 'rgba(0, 0, 0, 0.04)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setCompetitorPricesExpanded(!competitorPricesExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon sx={{ fontSize: 20, color: 'rgba(0, 0, 0, 0.7)' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.9)' }}>
                Versenytárs árak
              </Typography>
              {links.length > 0 && (
                <Chip 
                  label={links.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    bgcolor: 'rgba(0, 0, 0, 0.08)',
                    color: 'rgba(0, 0, 0, 0.8)',
                    fontWeight: 600
                  }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {links.length > 0 && productPrice && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                  {(() => {
                    const cheapest = links
                      .filter(l => l.latestPrice?.price && l.is_active)
                      .map(l => ({ price: l.latestPrice!.price!, name: l.competitor.name }))
                      .sort((a, b) => a.price - b.price)[0]
                    
                    if (!cheapest) return null
                    const diff = productPrice - cheapest.price
                    const percent = ((diff / cheapest.price) * 100)
                    
                    return (
                      <>
                        {percent > 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 18, color: 'error.main' }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        )}
                        <Typography variant="caption" color={percent > 0 ? 'error.main' : 'success.main'} fontWeight={600}>
                          {formatPercent(percent)}
                        </Typography>
                      </>
                    )
                  })()}
                </Box>
              )}
              <IconButton size="small">
                {competitorPricesExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={competitorPricesExpanded}>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    loadLinks()
                  }}
                  size="small"
                >
                  Frissítés
                </Button>
                {links.length > 0 && (
                  <Tooltip title={`Mind ellenőrzése (${links.filter(l => l.is_active).length * 2} Turitoken)`}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={scrapingLinkId ? <CircularProgress size={18} /> : <SearchIcon />}
                      onClick={(e) => {
                        e.stopPropagation()
                        links.forEach(link => {
                          if (link.is_active) handleScrapePrice(link)
                        })
                      }}
                      disabled={!!scrapingLinkId}
                      size="small"
                    >
                      {scrapingLinkId ? 'Ellenőrzés...' : 'Mind ellenőrzése'}
                    </Button>
                  </Tooltip>
                )}
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenDialog()
                  }}
                  disabled={competitors.length === 0}
                  size="small"
                >
                  Versenytárs hozzáadása
                </Button>
              </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

              {/* Competitor links - Compact table */}
              {links.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <StoreIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Még nincs versenytárs hozzárendelve
                  </Typography>
                  {competitors.length > 0 ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDialog()
                      }}
                    >
                      Versenytárs hozzáadása
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Először adjon hozzá versenytársakat a <strong>SEO → Versenytársak</strong> menüpont alatt
                    </Typography>
                  )}
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(0, 0, 0, 0.04)' }}>
                        <TableCell sx={{ fontWeight: 600, py: 1.5, color: 'rgba(0, 0, 0, 0.9)', borderBottom: '2px solid rgba(0, 0, 0, 0.12)' }}>Versenytárs</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1.5, color: 'rgba(0, 0, 0, 0.9)', borderBottom: '2px solid rgba(0, 0, 0, 0.12)' }} align="right">Nettó ár</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1.5, color: 'rgba(0, 0, 0, 0.9)', borderBottom: '2px solid rgba(0, 0, 0, 0.12)' }} align="center">Különbség</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 1.5, color: 'rgba(0, 0, 0, 0.9)', borderBottom: '2px solid rgba(0, 0, 0, 0.12)' }} align="right">Művelet</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {links.map((link) => {
                        const priceDiff = link.latestPrice ? getPriceDifference(link.latestPrice.price) : null
                        
                        return (
                          <TableRow 
                            key={link.id} 
                            hover
                            sx={{
                              '&:hover': {
                                bgcolor: 'rgba(0, 0, 0, 0.03)'
                              },
                              '& td': {
                                borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                                py: 1.5
                              }
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 0.5,
                                    bgcolor: 'rgba(33, 150, 243, 0.8)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {link.competitor.name.charAt(0).toUpperCase()}
                                </Box>
                                <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(0, 0, 0, 0.9)' }}>
                                  {link.competitor.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {link.latestPrice?.price ? (
                                <Typography variant="body2" fontWeight={600} sx={{ color: 'rgba(0, 0, 0, 0.9)' }}>
                                  {formatPrice(link.latestPrice.price)}
                                </Typography>
                              ) : (
                                <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.5)' }}>-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {priceDiff ? (
                                <Chip
                                  label={formatPercent(priceDiff.percent)}
                                  size="small"
                                  color={priceDiff.direction === 'up' ? 'error' : priceDiff.direction === 'down' ? 'success' : 'default'}
                                  sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.5)' }}>-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="Ár ellenőrzése (2 Turitoken)">
                                  <IconButton 
                                    size="small" 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleScrapePrice(link)
                                    }}
                                    disabled={!!scrapingLinkId}
                                  >
                                    {scrapingLinkId === link.id ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <SearchIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Szerkesztés">
                                  <IconButton 
                                    size="small" 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDialog(link)
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLink ? 'Versenytárs link szerkesztése' : 'Versenytárs hozzáadása'}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Versenytárs</InputLabel>
            <Select
              value={formData.competitor_id}
              label="Versenytárs"
              onChange={(e) => setFormData(prev => ({ ...prev, competitor_id: e.target.value }))}
              disabled={!!editingLink}
            >
              {competitors.map((comp) => (
                <MenuItem 
                  key={comp.id} 
                  value={comp.id}
                  disabled={!editingLink && links.some(l => l.competitor_id === comp.id)}
                >
                  {comp.name}
                  {links.some(l => l.competitor_id === comp.id) && ' (már hozzáadva)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Termék URL a versenytársnál"
            fullWidth
            value={formData.competitor_url}
            onChange={(e) => setFormData(prev => ({ ...prev, competitor_url: e.target.value }))}
            margin="normal"
            placeholder="https://example.com/product/123"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LinkIcon color="action" />
                </InputAdornment>
              )
            }}
            helperText="A termék oldal teljes URL-je a versenytárs weboldalán"
          />
          <TextField
            label="Versenytárs cikkszáma (opcionális)"
            fullWidth
            value={formData.competitor_sku}
            onChange={(e) => setFormData(prev => ({ ...prev, competitor_sku: e.target.value }))}
            margin="normal"
            placeholder="ABC-123"
            helperText="A termék cikkszáma a versenytársnál"
          />
          <TextField
            label="Termék neve a versenytársnál (opcionális)"
            fullWidth
            value={formData.competitor_product_name}
            onChange={(e) => setFormData(prev => ({ ...prev, competitor_product_name: e.target.value }))}
            margin="normal"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.competitor_id || !formData.competitor_url}
            startIcon={saving ? <CircularProgress size={20} /> : null}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Versenytárs link törlése</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan törölni szeretné a(z) <strong>{linkToDelete?.competitor.name}</strong> versenytárs linket?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Ez törli az összes ár előzményt is ehhez a versenytárshoz.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Mégse
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Törlés...' : 'Törlés'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Price Confirmation Dialog */}
      <Dialog open={applyPriceDialogOpen} onClose={() => setApplyPriceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ár alkalmazása</DialogTitle>
        <DialogContent>
          {priceToApply && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Biztosan alkalmazza az ajánlott árat?
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Jelenlegi ár:</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatPrice(priceToApply.currentPrice)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Ajánlott ár:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    color={priceToApply.recommendationType === 'increase' ? 'success.main' : 'error.main'}
                  >
                    {formatPrice(priceToApply.recommendedPrice)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Változás:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={600}
                    color={priceToApply.recommendationType === 'increase' ? 'success.main' : 'error.main'}
                  >
                    {formatPercent(priceToApply.priceChangePercent)}
                  </Typography>
                </Box>
                {priceToApply.margin !== null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">Árrés:</Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      color={priceToApply.margin < 0 ? 'error.main' : 'text.primary'}
                    >
                      {formatPrice(priceToApply.margin)} ({formatPercent(priceToApply.marginPercent || 0)})
                    </Typography>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {priceToApply.reason}
              </Typography>
              {priceToApply.minPrice && priceToApply.recommendedPrice === priceToApply.minPrice && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Ez az ár a minimum ár (költség + 5% árrést), hogy megőrizzük a jövedelmezőséget.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApplyPriceDialogOpen(false)} disabled={!!applyingPrice}>
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={confirmApplyPrice}
            disabled={!!applyingPrice || !onPriceUpdate}
            startIcon={applyingPrice ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {applyingPrice ? 'Alkalmazás...' : 'Alkalmaz'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

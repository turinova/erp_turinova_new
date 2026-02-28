'use client'

import { useState, useEffect, useCallback } from 'react'
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
  FormControl,
  InputLabel,
  InputAdornment,
  Skeleton
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
  Search as SearchIcon
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
  price: number | null           // Nettó price (for comparison)
  price_gross: number | null     // Bruttó price (original scraped)
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

interface Props {
  productId: string
  productPrice: number | null
  productName: string | null
  modelNumber: string | null
}

export default function CompetitorPricesTab({ productId, productPrice, productName, modelNumber }: Props) {
  const [links, setLinks] = useState<CompetitorLink[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
    loadLinks()
    loadCompetitors()
  }, [loadLinks, loadCompetitors])

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
    } catch (err: any) {
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
    } catch (err: any) {
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
        // Insufficient credits
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

      // Show success toast with price info
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

      // Reload links to show new price
      loadLinks()
    } catch (err: any) {
      toast.error(`Hiba: ${err.message}`)
      setError(err.message)
    } finally {
      setScrapingLinkId(null)
    }
  }

  // Scrape all competitors
  const handleScrapeAll = async () => {
    for (const link of links) {
      if (link.is_active) {
        await handleScrapePrice(link)
      }
    }
  }

  const formatPrice = (price: number | null | undefined, currency: string = 'HUF'): string => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency }).format(price)
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
      case 'up': return 'error.main' // We're more expensive
      case 'down': return 'success.main' // We're cheaper
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

  // Get competitors that are not yet linked
  const availableCompetitors = competitors.filter(
    c => !links.some(l => l.competitor_id === c.id)
  )

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          Kövesse nyomon versenytársai árait ehhez a termékhez
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadLinks}
            size="small"
          >
            Frissítés
          </Button>
          {links.length > 0 && (
            <Tooltip title={`Mind ellenőrzése (${links.filter(l => l.is_active).length * 2} credits)`}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={scrapingLinkId ? <CircularProgress size={18} /> : <SearchIcon />}
                onClick={handleScrapeAll}
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
            onClick={() => handleOpenDialog()}
            disabled={competitors.length === 0}
          >
            Versenytárs hozzáadása
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Product info card */}
      <Card sx={{ mb: 3, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Saját termékünk
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">{productName || 'Nincs név'}</Typography>
              {modelNumber && (
                <Typography variant="body2" color="text.secondary">
                  Gyártói cikkszám: <strong>{modelNumber}</strong>
                </Typography>
              )}
            </Box>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {formatPrice(productPrice)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Competitor links table */}
      {links.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <StoreIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Még nincs versenytárs hozzárendelve ehhez a termékhez
          </Typography>
          {competitors.length > 0 ? (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Első versenytárs hozzáadása
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Először adjon hozzá versenytársakat a <strong>SEO → Versenytársak</strong> menüpont alatt
            </Typography>
          )}
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Versenytárs</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Link</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Bruttó ár</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Nettó ár</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Különbség</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Utolsó ellenőrzés</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Műveletek</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {links.map((link) => {
                const priceDiff = link.latestPrice ? getPriceDifference(link.latestPrice.price) : null
                
                return (
                  <TableRow key={link.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1,
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                          }}
                        >
                          {link.competitor.name.charAt(0).toUpperCase()}
                        </Box>
                        <Box>
                          <Typography fontWeight={500}>{link.competitor.name}</Typography>
                          {link.competitor_sku && (
                            <Typography variant="caption" color="text.secondary">
                              SKU: {link.competitor_sku}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinkIcon fontSize="small" color="action" />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 200, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {link.competitor_url}
                        </Typography>
                        <Tooltip title="Megnyitás új ablakban">
                          <IconButton
                            size="small"
                            href={link.competitor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {link.latestPrice?.price_gross ? (
                        <Box>
                          <Typography fontWeight={600}>
                            {formatPrice(link.latestPrice.price_gross)}
                          </Typography>
                          {link.latestPrice.original_price && link.latestPrice.original_price !== link.latestPrice.price_gross && (
                            <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                              {formatPrice(link.latestPrice.original_price)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {link.latestPrice?.price ? (
                        <Typography fontWeight={600} color="primary.main">
                          {formatPrice(link.latestPrice.price)}
                        </Typography>
                      ) : (
                        <Typography color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {priceDiff ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {priceDiff.direction === 'up' && <TrendingUpIcon sx={{ color: 'error.main' }} />}
                          {priceDiff.direction === 'down' && <TrendingDownIcon sx={{ color: 'success.main' }} />}
                          {priceDiff.direction === 'same' && <TrendingFlatIcon sx={{ color: 'text.secondary' }} />}
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: getPriceComparisonColor(priceDiff.direction) }}
                          >
                            {priceDiff.percent > 0 ? '+' : ''}{priceDiff.percent.toFixed(1)}%
                          </Typography>
                        </Box>
                      ) : (
                        <Typography color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.last_checked_at ? (
                        <Typography variant="body2">
                          {new Date(link.last_checked_at).toLocaleString('hu-HU')}
                        </Typography>
                      ) : (
                        <Chip label="Nincs adat" size="small" color="default" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ár ellenőrzése (AI) - 2 credits">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleScrapePrice(link)}
                          disabled={!!scrapingLinkId}
                          sx={{ mr: 1 }}
                        >
                          {scrapingLinkId === link.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <SearchIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Szerkesztés">
                        <IconButton size="small" onClick={() => handleOpenDialog(link)} sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Törlés">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => {
                            setLinkToDelete(link)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
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
    </Box>
  )
}

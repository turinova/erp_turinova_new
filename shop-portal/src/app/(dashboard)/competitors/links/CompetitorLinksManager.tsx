'use client'

import React, { useState, useRef, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
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
  LinearProgress,
  InputAdornment
} from '@mui/material'
import {
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Refresh as RefreshIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
  Link as LinkIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowRight as CollapseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import * as XLSX from 'xlsx'

interface Competitor {
  id: string
  name: string
  website_url: string
}

interface CompetitorLink {
  id: string
  competitor_url: string
  competitor_sku: string | null
  competitor_product_name: string | null
  matching_method: string
  is_active: boolean
  last_checked_at: string | null
  last_error: string | null
  competitor: Competitor
  product: {
    id: string
    sku: string
    name: string | null
    model_number: string | null
    price: number | null
  }
  latestPrice: {
    price: number | null
    price_gross: number | null
    scraped_at: string
  } | null
}

interface ProductGroup {
  productId: string
  sku: string
  name: string | null
  modelNumber: string | null
  ourPrice: number | null
  links: CompetitorLink[]
  minCompetitorPrice: number | null
  maxCompetitorPrice: number | null
  averageCompetitorPrice: number | null
  competitorCount: number
  hasData: boolean
}

interface Props {
  initialLinks: CompetitorLink[]
  competitors: Competitor[]
}

export default function CompetitorLinksManager({ initialLinks, competitors }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [links, setLinks] = useState<CompetitorLink[]>(initialLinks)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  
  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  
  // Refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 })

  // Group links by product
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, ProductGroup>()
    
    links.forEach(link => {
      const productId = link.product.id
      
      if (!groups.has(productId)) {
        groups.set(productId, {
          productId,
          sku: link.product.sku,
          name: link.product.name,
          modelNumber: link.product.model_number,
          ourPrice: link.product.price,
          links: [],
          minCompetitorPrice: null,
          maxCompetitorPrice: null,
          averageCompetitorPrice: null,
          competitorCount: 0,
          hasData: false
        })
      }
      
      const group = groups.get(productId)!
      group.links.push(link)
      group.competitorCount++
      
      if (link.latestPrice?.price) {
        group.hasData = true
        if (group.minCompetitorPrice === null || link.latestPrice.price < group.minCompetitorPrice) {
          group.minCompetitorPrice = link.latestPrice.price
        }
        if (group.maxCompetitorPrice === null || link.latestPrice.price > group.maxCompetitorPrice) {
          group.maxCompetitorPrice = link.latestPrice.price
        }
      }
    })
    
    // Calculate averages
    groups.forEach(group => {
      const prices = group.links
        .map(l => l.latestPrice?.price)
        .filter((p): p is number => p !== null && p !== undefined)
      
      if (prices.length > 0) {
        group.averageCompetitorPrice = prices.reduce((a, b) => a + b, 0) / prices.length
      }
    })
    
    return Array.from(groups.values())
  }, [links])

  // Filter groups based on search
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedProducts
    const search = searchTerm.toLowerCase()
    return groupedProducts.filter(group => 
      group.sku.toLowerCase().includes(search) ||
      group.name?.toLowerCase().includes(search) ||
      group.modelNumber?.toLowerCase().includes(search) ||
      group.links.some(l => l.competitor.name.toLowerCase().includes(search))
    )
  }, [groupedProducts, searchTerm])

  // Toggle group expansion
  const toggleGroup = (productId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedGroups(newExpanded)
  }

  // Expand/Collapse all
  const expandAll = () => {
    setExpandedGroups(new Set(filteredGroups.map(g => g.productId)))
  }

  const collapseAll = () => {
    setExpandedGroups(new Set())
  }

  // Selection handlers - now work with link IDs within groups
  const handleSelectAllInGroup = (group: ProductGroup, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    group.links.forEach(link => {
      if (checked) {
        newSelected.add(link.id)
      } else {
        newSelected.delete(link.id)
      }
    })
    setSelectedIds(newSelected)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(links.map(l => l.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (linkId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(linkId)) {
      newSelected.delete(linkId)
    } else {
      newSelected.add(linkId)
    }
    setSelectedIds(newSelected)
  }

  const isGroupSelected = (group: ProductGroup) => {
    return group.links.every(link => selectedIds.has(link.id))
  }

  const isGroupIndeterminate = (group: ProductGroup) => {
    const selectedCount = group.links.filter(link => selectedIds.has(link.id)).length
    return selectedCount > 0 && selectedCount < group.links.length
  }

  const isAllSelected = links.length > 0 && selectedIds.size === links.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < links.length

  // Format price
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('hu-HU', { 
      style: 'currency', 
      currency: 'HUF',
      maximumFractionDigits: 0
    }).format(price)
  }

  // Calculate price difference
  const getPriceDiff = (ourPrice: number | null, theirPrice: number | null) => {
    if (!ourPrice || !theirPrice) return null
    const diff = ourPrice - theirPrice
    const percent = ((diff / theirPrice) * 100)
    return { diff, percent }
  }

  // Get status for a product group
  const getGroupStatus = (group: ProductGroup): 'cheaper' | 'expensive' | 'same' | 'nodata' => {
    if (!group.hasData || !group.ourPrice || !group.minCompetitorPrice) return 'nodata'
    const diff = ((group.ourPrice - group.minCompetitorPrice) / group.minCompetitorPrice) * 100
    if (diff > 5) return 'expensive'
    if (diff < -5) return 'cheaper'
    return 'same'
  }

  // Download Sample Excel
  const handleDownloadSample = () => {
    const competitorNames = competitors.map(c => c.name).join(', ')
    
    const sampleData = [
      {
        'Saját SKU': 'ABC-12345',
        'Versenytárs': competitors[0]?.name || 'VasalatWebshop',
        'Versenytárs URL': 'https://example.com/product/termek-neve-abc12345'
      },
      {
        'Saját SKU': 'ABC-12345',
        'Versenytárs': competitors[1]?.name || 'Bútorkellék',
        'Versenytárs URL': 'https://example2.com/termekek/termek-abc-12345'
      },
      {
        'Saját SKU': 'DEF-67890',
        'Versenytárs': competitors[0]?.name || 'VasalatWebshop',
        'Versenytárs URL': 'https://example.com/product/masik-termek-def67890'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Minta')
    
    const instructions = [
      { 'Útmutató': '📋 VERSENYTÁRS LINKEK IMPORT ÚTMUTATÓ' },
      { 'Útmutató': '' },
      { 'Útmutató': '1. Kötelező oszlopok:' },
      { 'Útmutató': '   • Saját SKU - Az Ön terméke cikkszáma (pontosan egyezzen a rendszerben lévővel)' },
      { 'Útmutató': '   • Versenytárs - A versenytárs neve (pontosan egyezzen a rendszerben lévővel)' },
      { 'Útmutató': '   • Versenytárs URL - A versenytárs termék oldal teljes URL címe' },
      { 'Útmutató': '' },
      { 'Útmutató': '2. Elérhető versenytársak:' },
      { 'Útmutató': `   ${competitorNames || 'Még nincs felvett versenytárs'}` },
      { 'Útmutató': '' },
      { 'Útmutató': '3. Fontos tudnivalók:' },
      { 'Útmutató': '   • Egy SKU-hoz több versenytárs is megadható (külön sorokban)' },
      { 'Útmutató': '   • A rendszer automatikusan kiszűri a már meglévő linkeket' },
      { 'Útmutató': '   • Az URL-nek teljes címnek kell lennie (https://...)' },
      { 'Útmutató': '' },
      { 'Útmutató': '4. Import után:' },
      { 'Útmutató': '   • Kattintson a "Mind frissítése" gombra az árak lekéréséhez' },
      { 'Útmutató': '   • Az AI automatikusan kinyeri az árakat a megadott oldalakról' }
    ]
    
    const wsInstructions = XLSX.utils.json_to_sheet(instructions)
    wsInstructions['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Útmutató')

    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 50 }]

    XLSX.writeFile(wb, 'versenytars_linkek_MINTA.xlsx')
    toast.success('Minta fájl letöltve!')
  }

  // Excel Export
  const handleExport = () => {
    const exportData = links.map(link => ({
      'Saját SKU': link.product.sku,
      'Gyártói cikkszám': link.product.model_number || '',
      'Termék név': link.product.name || '',
      'Saját nettó ár': link.product.price || '',
      'Versenytárs': link.competitor.name,
      'Versenytárs ár': link.latestPrice?.price || '',
      'Különbség (%)': link.product.price && link.latestPrice?.price 
        ? (((link.product.price - link.latestPrice.price) / link.latestPrice.price) * 100).toFixed(1)
        : '',
      'Versenytárs URL': link.competitor_url,
      'Utolsó ellenőrzés': link.last_checked_at 
        ? new Date(link.last_checked_at).toLocaleDateString('hu-HU')
        : ''
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Versenytárs linkek')
    
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
    ws['!cols'] = colWidths

    XLSX.writeFile(wb, `versenytars_linkek_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Excel fájl exportálva!')
  }

  // Excel Import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const validData = jsonData.filter((row: any) => {
          return row['Saját SKU'] && row['Versenytárs'] && row['Versenytárs URL']
        }).map((row: any) => ({
          sku: String(row['Saját SKU']).trim(),
          competitorName: String(row['Versenytárs']).trim(),
          competitorUrl: String(row['Versenytárs URL']).trim()
        }))

        if (validData.length === 0) {
          toast.error('Nincs érvényes adat a fájlban. Ellenőrizze az oszlopneveket!')
          return
        }

        setImportData(validData)
        setImportDialogOpen(true)
      } catch (error) {
        console.error('Error parsing Excel:', error)
        toast.error('Hiba az Excel fájl olvasásakor')
      }
    }
    reader.readAsArrayBuffer(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImportConfirm = async () => {
    setImporting(true)
    setImportProgress(0)
    
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < importData.length; i++) {
      const row = importData[i]
      setImportProgress(Math.round(((i + 1) / importData.length) * 100))
      
      try {
        const competitor = competitors.find(c => 
          c.name.toLowerCase() === row.competitorName.toLowerCase()
        )
        
        if (!competitor) {
          console.error(`Competitor not found: ${row.competitorName}`)
          errorCount++
          continue
        }

        const response = await fetch(`/api/products/search?q=${encodeURIComponent(row.sku)}&limit=1`)
        if (!response.ok) {
          errorCount++
          continue
        }
        
        const searchResult = await response.json()
        const product = searchResult.products?.find((p: any) => p.sku === row.sku)
        
        if (!product) {
          console.error(`Product not found: ${row.sku}`)
          errorCount++
          continue
        }

        const linkResponse = await fetch(`/api/products/${product.id}/competitor-links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitor_id: competitor.id,
            competitor_url: row.competitorUrl
          })
        })

        if (linkResponse.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        console.error('Import error:', error)
        errorCount++
      }
    }

    setImporting(false)
    setImportDialogOpen(false)
    setImportData([])
    
    toast.success(`Import kész! ${successCount} sikeres, ${errorCount} sikertelen`)
    router.refresh()
  }

  // Refresh all prices - Using BATCH API for maximum speed
  const handleRefreshAll = async () => {
    const linksToRefresh = selectedIds.size > 0 
      ? links.filter(l => selectedIds.has(l.id))
      : links

    if (linksToRefresh.length === 0) {
      toast.info('Nincs frissítendő link')
      return
    }

    setRefreshing(true)
    setRefreshProgress({ current: 0, total: linksToRefresh.length })

    let successCount = 0
    let errorCount = 0

    // Process in batches of 5 (smaller batches to avoid rate limits)
    const BATCH_SIZE = 5
    
    for (let i = 0; i < linksToRefresh.length; i += BATCH_SIZE) {
      const batch = linksToRefresh.slice(i, i + BATCH_SIZE)
      
      // Prepare batch request
      const requests = batch.map(link => ({
        linkId: link.id,
        productId: link.product.id,
        competitorId: link.competitor.id,
        url: link.competitor_url
      }))

      try {
        const response = await fetch('/api/scrape/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests })
        })

        if (response.ok) {
          const result = await response.json()
          // Count actual results instead of relying on stats (more accurate)
          if (result.results && Array.isArray(result.results)) {
            const batchSuccess = result.results.filter((r: any) => r.success).length
            const batchFailed = result.results.filter((r: any) => !r.success).length
            successCount += batchSuccess
            errorCount += batchFailed
          } else {
            // Fallback to stats if results array is missing
            successCount += result.stats?.successful || 0
            errorCount += result.stats?.failed || 0
          }
        } else {
          // If batch fails, count all as errors
          errorCount += batch.length
        }
      } catch (error) {
        console.error('Batch scrape error:', error)
        errorCount += batch.length
      }

      setRefreshProgress({ 
        current: Math.min(i + BATCH_SIZE, linksToRefresh.length), 
        total: linksToRefresh.length 
      })
    }

    setRefreshing(false)
    toast.success(`Frissítés kész! ${successCount} sikeres, ${errorCount} sikertelen`)
    router.refresh()
  }

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    
    if (!confirm(`Biztosan törölni szeretné a ${selectedIds.size} kiválasztott linket?`)) {
      return
    }

    let successCount = 0
    for (const linkId of selectedIds) {
      const link = links.find(l => l.id === linkId)
      if (!link) continue

      try {
        const response = await fetch(
          `/api/products/${link.product.id}/competitor-links/${linkId}`,
          { method: 'DELETE' }
        )
        if (response.ok) successCount++
      } catch (error) {
        console.error('Delete error:', error)
      }
    }

    toast.success(`${successCount} link törölve`)
    setSelectedIds(new Set())
    router.refresh()
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Versenytárs Linkek Kezelése
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredGroups.length} termék • {links.length} link összesen • {selectedIds.size > 0 ? `${selectedIds.size} kiválasztva` : 'Válasszon linkeket a tömeges műveletekhez'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
              />
              <Tooltip title="Töltsön le egy minta Excel fájlt az import formátummal">
                <Button
                  variant="text"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleDownloadSample}
                >
                  Minta letöltése
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                startIcon={<FileUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Excel Import
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExport}
                disabled={links.length === 0}
              >
                Excel Export
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={handleRefreshAll}
                disabled={refreshing || links.length === 0}
              >
                {selectedIds.size > 0 ? `Kiválasztottak frissítése (${selectedIds.size})` : 'Mind frissítése'}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteSelected}
                >
                  Törlés ({selectedIds.size})
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Refresh Progress */}
      {refreshing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography>
              Frissítés folyamatban... {refreshProgress.current}/{refreshProgress.total}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(refreshProgress.current / refreshProgress.total) * 100} 
            sx={{ mt: 1 }}
          />
        </Alert>
      )}

      {/* Search & Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          fullWidth
          placeholder="Keresés SKU, termék név, gyártói cikkszám vagy versenytárs alapján..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button size="small" onClick={expandAll} disabled={filteredGroups.length === 0}>
          Mind kinyit
        </Button>
        <Button size="small" onClick={collapseAll} disabled={expandedGroups.size === 0}>
          Mind becsuk
        </Button>
      </Box>

      {/* Grouped Links Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell padding="checkbox" sx={{ width: 48 }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ width: 48 }}></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Termék</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Saját ár</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Versenytársak</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Min. ár</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Max. ár</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Státusz</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <LinkIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    {searchTerm ? 'Nincs találat' : 'Nincs versenytárs link'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.productId)
                const status = getGroupStatus(group)
                
                return (
                  <React.Fragment key={group.productId}>
                    {/* Main Product Row */}
                    <TableRow 
                      hover 
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: isExpanded ? 'action.selected' : undefined,
                        '& > td': { borderBottom: isExpanded ? 'none' : undefined }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isGroupSelected(group)}
                          indeterminate={isGroupIndeterminate(group)}
                          onChange={(e) => handleSelectAllInGroup(group, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell onClick={() => toggleGroup(group.productId)}>
                        <IconButton size="small">
                          {isExpanded ? <ExpandIcon /> : <CollapseIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell onClick={() => toggleGroup(group.productId)}>
                        <Typography variant="body2" fontWeight={600}>
                          {group.sku}
                        </Typography>
                        {group.modelNumber && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {group.modelNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell onClick={() => toggleGroup(group.productId)}>
                        <Typography variant="body2" sx={{ maxWidth: 300 }} noWrap>
                          {group.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={() => toggleGroup(group.productId)}>
                        <Typography variant="body2" fontWeight={500}>
                          {formatPrice(group.ourPrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={() => toggleGroup(group.productId)}>
                        <Chip 
                          label={`${group.competitorCount} versenytárs`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" onClick={() => toggleGroup(group.productId)}>
                        <Typography variant="body2" fontWeight={500} color={status === 'expensive' ? 'error.main' : undefined}>
                          {formatPrice(group.minCompetitorPrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={() => toggleGroup(group.productId)}>
                        <Typography variant="body2">
                          {formatPrice(group.maxCompetitorPrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={() => toggleGroup(group.productId)}>
                        {status === 'nodata' && (
                          <Chip label="Nincs adat" size="small" color="default" />
                        )}
                        {status === 'cheaper' && (
                          <Chip 
                            icon={<CheckCircleIcon />} 
                            label="Olcsóbb" 
                            size="small" 
                            color="success"
                          />
                        )}
                        {status === 'expensive' && (
                          <Chip 
                            icon={<WarningIcon />} 
                            label="Drágább" 
                            size="small" 
                            color="error"
                          />
                        )}
                        {status === 'same' && (
                          <Chip 
                            icon={<TrendingFlatIcon />} 
                            label="Hasonló" 
                            size="small" 
                            color="info"
                          />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Competitor Details */}
                    {isExpanded && group.links.map((link) => {
                      const priceDiff = getPriceDiff(group.ourPrice, link.latestPrice?.price || null)
                      
                      return (
                        <TableRow 
                          key={link.id} 
                          hover
                          sx={{ bgcolor: 'grey.50' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selectedIds.has(link.id)}
                              onChange={() => handleSelectOne(link.id)}
                            />
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                └
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {link.competitor.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={500}>
                              {formatPrice(link.latestPrice?.price || null)}
                            </Typography>
                            {link.latestPrice?.price_gross && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                bruttó: {formatPrice(link.latestPrice.price_gross)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {priceDiff ? (
                              <Chip
                                size="small"
                                label={`${priceDiff.percent > 0 ? '+' : ''}${priceDiff.percent.toFixed(1)}%`}
                                color={priceDiff.percent > 2 ? 'error' : priceDiff.percent < -2 ? 'success' : 'default'}
                                icon={
                                  priceDiff.percent > 2 ? <TrendingUpIcon /> : 
                                  priceDiff.percent < -2 ? <TrendingDownIcon /> : 
                                  <TrendingFlatIcon />
                                }
                              />
                            ) : (
                              <Typography variant="body2" color="text.disabled">-</Typography>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" color="text.secondary">
                              {link.last_checked_at 
                                ? new Date(link.last_checked_at).toLocaleDateString('hu-HU')
                                : '-'
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={link.competitor_url}>
                              <IconButton
                                size="small"
                                href={link.competitor_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => !importing && setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Excel Import</DialogTitle>
        <DialogContent>
          {importing ? (
            <Box sx={{ py: 2 }}>
              <Typography gutterBottom>Import folyamatban...</Typography>
              <LinearProgress variant="determinate" value={importProgress} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {importProgress}% kész
              </Typography>
            </Box>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>{importData.length}</strong> érvényes sor található a fájlban.
                </Typography>
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Elvárt oszlopok: <strong>Saját SKU</strong>, <strong>Versenytárs</strong>, <strong>Versenytárs URL</strong>
              </Typography>
              {importData.length > 0 && (
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Versenytárs</TableCell>
                        <TableCell>URL</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importData.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.competitorName}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.competitorUrl}
                          </TableCell>
                        </TableRow>
                      ))}
                      {importData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            ... és még {importData.length - 10} sor
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>
            Mégse
          </Button>
          <Button 
            variant="contained" 
            onClick={handleImportConfirm}
            disabled={importing || importData.length === 0}
          >
            Importálás
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

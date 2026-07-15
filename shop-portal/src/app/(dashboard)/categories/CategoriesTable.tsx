'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material'
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Category as CategoryIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  AutoAwesome as AutoAwesomeIcon,
  Sync as SyncIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

const HU_LANG_ID = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=='
const FULL_SEO_BATCH = 5
const SYNC_BATCH = 20
const FULL_SEO_CREDITS = 1

interface CategoryDescription {
  name?: string
  language_id: string
  description?: string | null
  footer_seo_text?: string | null
  custom_title?: string | null
  meta_description?: string | null
}

interface Category {
  id: string
  name: string | null
  shoprenter_id: string
  status: number
  sync_status: string
  category_url: string | null
  last_synced_at: string | null
  parent_category_id: string | null
  sort_order?: number
  shoprenter_category_descriptions?: CategoryDescription[]
}

interface Connection {
  id: string
  name: string
  connection_type: string
}

interface CategoriesTableProps {
  initialCategories: Category[]
  connections: Connection[]
  initialConnectionId: string
  initialSearch: string
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
  level: number
}

interface BulkItemResult {
  categoryId: string
  categoryName: string
  status: string
  error?: string
  creditsUsed?: number
}

function getHuDesc(category: Category): CategoryDescription | undefined {
  return (
    category.shoprenter_category_descriptions?.find((d) => d.language_id === HU_LANG_ID) ||
    category.shoprenter_category_descriptions?.[0]
  )
}

function plainLen(html: string | null | undefined): number {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length
}

function getContentStatus(category: Category): 'empty' | 'partial' | 'complete' {
  const d = getHuDesc(category)
  if (!d) return 'empty'

  const hasIntro = plainLen(d.description) >= 30
  const hasFooter = plainLen(d.footer_seo_text) >= 80
  const hasMetaTitle = (d.custom_title || '').trim().length >= 10
  const hasMetaDesc = (d.meta_description || '').trim().length >= 50

  const count = [hasIntro, hasFooter, hasMetaTitle, hasMetaDesc].filter(Boolean).length
  if (count === 4) return 'complete'
  if (count === 0) return 'empty'
  return 'partial'
}

export default function CategoriesTable({
  initialCategories,
  connections,
  initialConnectionId,
  initialSearch
}: CategoriesTableProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [selectedConnectionId, setSelectedConnectionId] = useState(initialConnectionId)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [progressTitle, setProgressTitle] = useState('')
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressItems, setProgressItems] = useState<BulkItemResult[]>([])
  const [progressDone, setProgressDone] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Re-sync client state when server re-fetches after router.refresh()
  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    setSelectedConnectionId(initialConnectionId)
  }, [initialConnectionId])

  useEffect(() => {
    setSearchTerm(initialSearch)
  }, [initialSearch])

  const parentIdsWithChildren = useMemo(() => {
    const childParentIds = new Set(
      categories.map((c) => c.parent_category_id).filter(Boolean) as string[]
    )
    return childParentIds
  }, [categories])

  const expandAllCategories = useCallback(() => {
    setExpandedCategories(new Set(parentIdsWithChildren))
  }, [parentIdsWithChildren])

  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set())
  }, [])

  const refreshCategoriesFromServer = useCallback(async () => {
    if (!selectedConnectionId) return
    try {
      const res = await fetch(
        `/api/categories?connection_id=${encodeURIComponent(selectedConnectionId)}&full=1`
      )
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories)
        }
      }
    } catch (e) {
      console.error('Failed to refresh categories:', e)
    }
    router.refresh()
  }, [router, selectedConnectionId])

  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, CategoryTreeNode>()
    const rootCategories: CategoryTreeNode[] = []

    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [], level: 0 })
    })

    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id)!
      if (cat.parent_category_id && categoryMap.has(cat.parent_category_id)) {
        const parent = categoryMap.get(cat.parent_category_id)!
        parent.children.push(node)
        node.level = parent.level + 1
      } else {
        rootCategories.push(node)
      }
    })

    const sortChildren = (nodes: CategoryTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
          return a.sort_order - b.sort_order
        }
        const nameA = a.name || a.shoprenter_category_descriptions?.[0]?.name || ''
        const nameB = b.name || b.shoprenter_category_descriptions?.[0]?.name || ''
        return nameA.localeCompare(nameB, 'hu')
      })
      nodes.forEach((node) => sortChildren(node.children))
    }

    sortChildren(rootCategories)
    return rootCategories
  }, [categories])

  const flattenTree = (nodes: CategoryTreeNode[], level: number = 0): CategoryTreeNode[] => {
    const result: CategoryTreeNode[] = []
    nodes.forEach((node) => {
      node.level = level
      result.push(node)
      if (expandedCategories.has(node.id) && node.children.length > 0) {
        result.push(...flattenTree(node.children, level + 1))
      }
    })
    return result
  }

  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return categoryTree

    const searchLower = searchTerm.toLowerCase()
    const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
      const name = node.name || node.shoprenter_category_descriptions?.[0]?.name || ''
      const matches =
        name.toLowerCase().includes(searchLower) ||
        node.shoprenter_id.toLowerCase().includes(searchLower)

      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((child): child is CategoryTreeNode => child !== null)

      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    }

    return categoryTree
      .map((node) => filterNode(node))
      .filter((node): node is CategoryTreeNode => node !== null)
  }, [categoryTree, searchTerm])

  const displayedCategories = flattenTree(filteredTree)

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) newSet.delete(categoryId)
      else newSet.add(categoryId)
      return newSet
    })
  }

  const extractSlug = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).pathname.replace(/^\//, '') || ''
    } catch {
      return url.replace(/^https?:\/\/[^\/]+\//, '') || ''
    }
  }

  const translateSyncStatus = (status: string): string => {
    const translations: Record<string, string> = {
      synced: 'Szinkronizálva',
      pending: 'Függőben',
      error: 'Hiba'
    }
    return translations[status] || status
  }

  const getSyncStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    if (status === 'synced') return 'success'
    if (status === 'error') return 'error'
    if (status === 'pending') return 'warning'
    return 'default'
  }

  const getContentChip = (category: Category) => {
    const status = getContentStatus(category)
    const map = {
      empty: { label: 'Üres', color: 'default' as const },
      partial: { label: 'Részleges', color: 'warning' as const },
      complete: { label: 'Kész', color: 'success' as const }
    }
    const { label, color } = map[status]
    return <Chip label={label} size="small" color={color} sx={{ fontSize: '0.75rem', height: 24 }} />
  }

  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnectionId(connectionId)
    setSelectedIds(new Set())
    router.push(`/categories?connectionId=${connectionId}&search=${encodeURIComponent(searchTerm)}`)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    router.push(`/categories?connectionId=${selectedConnectionId}&search=${encodeURIComponent(value)}`)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(displayedCategories.map((c) => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (categoryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const isAllSelected =
    displayedCategories.length > 0 && selectedIds.size === displayedCategories.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < displayedCategories.length

  const finishBulkOperation = useCallback(async () => {
    setSelectedIds(new Set())
    await refreshCategoriesFromServer()
  }, [refreshCategoriesFromServer])

  const handleBulkGenerate = async () => {
    setGenerateDialogOpen(false)
    const ids = Array.from(selectedIds)
    if (!ids.length) return

    setIsGenerating(true)
    setProgressDialogOpen(true)
    setProgressTitle('Full SEO generálás')
    setProgressCurrent(0)
    setProgressTotal(ids.length)
    setProgressItems([])
    setProgressDone(false)
    setProgressError(null)

    let totalGenerated = 0
    let totalSkipped = 0
    let totalFailed = 0
    const allItems: BulkItemResult[] = []

    try {
      for (let i = 0; i < ids.length; i += FULL_SEO_BATCH) {
        const batch = ids.slice(i, i + FULL_SEO_BATCH)
        const response = await fetch('/api/categories/bulk-generate-full-seo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryIds: batch,
            onlyMissing: true,
            skipOnValidationError: true
          })
        })

        const result = await response.json()

        if (!response.ok) {
          if (response.status === 402 && result.credits) {
            throw new Error(
              `Nincs elég Turitoken! Szükséges: ${result.credits.required}, elérhető: ${result.credits.available}`
            )
          }
          throw new Error(result.error || 'Generálási hiba')
        }

        const items = result.results?.items || []
        for (const item of items) {
          allItems.push({
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            status: item.status,
            error: item.error,
            creditsUsed: item.creditsUsed
          })
          if (item.status === 'generated') totalGenerated++
          else if (item.status === 'skipped') totalSkipped++
          else totalFailed++
        }

        setProgressCurrent(Math.min(i + batch.length, ids.length))
        setProgressItems([...allItems])
      }

      setProgressDone(true)
      toast.success(
        `Full SEO kész: ${totalGenerated} generálva, ${totalSkipped} kihagyva, ${totalFailed} hiba`
      )
      await finishBulkOperation()
    } catch (e: any) {
      setProgressError(e?.message || 'Generálási hiba')
      toast.error(e?.message || 'Generálási hiba')
    } finally {
      setIsGenerating(false)
      setProgressDone(true)
    }
  }

  const handleBulkSync = async () => {
    setSyncDialogOpen(false)
    const ids = Array.from(selectedIds)
    if (!ids.length) return

    setIsSyncing(true)
    setProgressDialogOpen(true)
    setProgressTitle('Szinkronizálás ShopRenterbe')
    setProgressCurrent(0)
    setProgressTotal(ids.length)
    setProgressItems([])
    setProgressDone(false)
    setProgressError(null)

    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)

    try {
      for (let i = 0; i < ids.length; i += SYNC_BATCH) {
        const batch = ids.slice(i, i + SYNC_BATCH)

        const response = await fetch('/api/categories/bulk-sync-to-shoprenter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryIds: batch })
        })

        const result = await response.json()
        if (!result.success || !result.progressKey) {
          throw new Error(result.error || 'Szinkron indítási hiba')
        }

        const progressKey = result.progressKey

        await new Promise<void>((resolve, reject) => {
          syncIntervalRef.current = setInterval(async () => {
            try {
              const pr = await fetch(
                `/api/categories/bulk-progress?key=${encodeURIComponent(progressKey)}`
              )
              if (!pr.ok) return

              const data = await pr.json()
              if (!data.success || !data.progress) return

              const { current, status, itemLog } = data.progress
              setProgressCurrent(i + (current || 0))
              setProgressTotal(ids.length)

              if (itemLog?.length) {
                const mapped: BulkItemResult[] = itemLog.map(
                  (log: { id: string; name: string; status: string; error?: string }) => ({
                    categoryId: log.id,
                    categoryName: log.name,
                    status: log.status,
                    error: log.error
                  })
                )
                setProgressItems((prev) => {
                  const byId = new Map(prev.map((p) => [p.categoryId, p]))
                  mapped.forEach((m) => byId.set(m.categoryId, m))
                  return Array.from(byId.values())
                })
              }

              if (status === 'completed' || status === 'error' || status === 'stopped') {
                if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
                syncIntervalRef.current = null
                if (status === 'error') reject(new Error('Szinkron hibával végződött'))
                else resolve()
              }
            } catch (pollErr) {
              console.error('Poll error:', pollErr)
            }
          }, 1000)
        })
      }

      setProgressDone(true)
      toast.success(`${ids.length} kategória szinkronizálása befejezve`)
      await finishBulkOperation()
    } catch (e: any) {
      setProgressError(e?.message || 'Szinkron hiba')
      toast.error(e?.message || 'Szinkron hiba')
    } finally {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
      setIsSyncing(false)
      setProgressDone(true)
    }
  }

  const shoprenterConnections = connections.filter((c) => c.connection_type === 'shoprenter')
  const selectedCount = selectedIds.size
  const estimatedCredits = selectedCount * FULL_SEO_CREDITS

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Kategóriák kezelése</Typography>
        {shoprenterConnections.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Kapcsolat</InputLabel>
            <Select
              value={selectedConnectionId}
              label="Kapcsolat"
              onChange={(e) => handleConnectionChange(e.target.value)}
            >
              {shoprenterConnections.map((conn) => (
                <MenuItem key={conn.id} value={conn.id}>
                  {conn.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {selectedCount > 0 && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedCount} kategória kijelölve
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setGenerateDialogOpen(true)}
            disabled={isGenerating || isSyncing}
          >
            Full SEO generálás
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SyncIcon />}
            onClick={() => setSyncDialogOpen(true)}
            disabled={isGenerating || isSyncing}
          >
            Szinkronizálás ShopRenterbe
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            Kijelölés törlése
          </Button>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          placeholder="Keresés kategória neve vagy ID szerint..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <Button size="small" variant="outlined" onClick={expandAllCategories}>
          Összes kinyitása
        </Button>
        <Button size="small" variant="outlined" onClick={collapseAllCategories}>
          Összes becsukása
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ width: '32%' }}>Név</TableCell>
              <TableCell sx={{ width: '10%' }}>Tartalom</TableCell>
              <TableCell sx={{ width: '10%' }}>Státusz</TableCell>
              <TableCell sx={{ width: '12%' }}>Szinkron</TableCell>
              <TableCell sx={{ width: '18%' }}>URL</TableCell>
              <TableCell sx={{ width: '8%' }} align="right">
                Műveletek
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CategoryIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="body1" color="text.secondary">
                      {categories.length === 0
                        ? 'Nincs szinkronizált kategória'
                        : 'Nincs találat a keresésre'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              displayedCategories.map((category) => {
                const categoryName =
                  category.name ||
                  category.shoprenter_category_descriptions?.[0]?.name ||
                  'Névtelen kategória'
                const hasChildren = category.children.length > 0
                const isExpanded = expandedCategories.has(category.id)
                const slug = extractSlug(category.category_url)

                return (
                  <TableRow key={category.id} hover selected={selectedIds.has(category.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(category.id)}
                        onChange={() => handleSelectOne(category.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: category.level * 24, display: 'inline-block' }} />
                        {hasChildren ? (
                          <IconButton
                            size="small"
                            onClick={() => toggleExpand(category.id)}
                            sx={{ p: 0.5, width: 24, height: 24 }}
                          >
                            {isExpanded ? (
                              <ExpandMoreIcon fontSize="small" />
                            ) : (
                              <ChevronRightIcon fontSize="small" />
                            )}
                          </IconButton>
                        ) : (
                          <Box sx={{ width: 24, display: 'inline-block' }} />
                        )}
                        {hasChildren ? (
                          isExpanded ? (
                            <FolderOpenIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
                          ) : (
                            <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
                          )
                        ) : (
                          <CategoryIcon
                            sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5, ml: 0.5 }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: category.level === 0 ? 600 : category.level === 1 ? 500 : 400,
                            color: category.level === 0 ? 'text.primary' : 'text.secondary'
                          }}
                        >
                          {categoryName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{getContentChip(category)}</TableCell>
                    <TableCell>
                      <Chip
                        label={category.status === 1 ? 'Aktív' : 'Inaktív'}
                        size="small"
                        color={category.status === 1 ? 'success' : 'default'}
                        sx={{ fontSize: '0.75rem', height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={translateSyncStatus(category.sync_status || 'pending')}
                        size="small"
                        color={getSyncStatusColor(category.sync_status || 'pending')}
                        sx={{ fontSize: '0.75rem', height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      {slug ? (
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}
                        >
                          {slug}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Nincs URL
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Kategória szerkesztése">
                        <IconButton
                          size="small"
                          component={NextLink}
                          href={`/categories/${category.id}`}
                          color="primary"
                          sx={{ width: 32, height: 32 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Generate confirm */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Full SEO generálás</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selectedCount} kategória — GEO intro + footer SEO + meta title + meta description.
            A <strong>kategórianév nem módosul</strong>.
          </Typography>
          <Alert severity="info" sx={{ mb: 1 }}>
            Becsült költség: <strong>{estimatedCredits} Turitoken</strong> ({FULL_SEO_CREDITS}/kategória)
          </Alert>
          <Alert severity="warning">
            Csak üres mezőket tölt ki. Validation hibánál nem ír felül. Szinkron külön lépés.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Mégse</Button>
          <Button variant="contained" color="secondary" onClick={handleBulkGenerate}>
            Generálás indítása
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync confirm */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Szinkronizálás ShopRenterbe</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {selectedCount} kategória leírás/meta mezőinek feltöltése a webshopba.
          </Typography>
          <Alert severity="info">
            A szinkron batch-enként fut (max {SYNC_BATCH}/kérés), ShopRenter rate limit betartással.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Mégse</Button>
          <Button variant="contained" onClick={handleBulkSync}>
            Szinkron indítása
          </Button>
        </DialogActions>
      </Dialog>

      {/* Progress */}
      <Dialog
        open={progressDialogOpen}
        onClose={() => !isGenerating && !isSyncing && setProgressDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{progressTitle}</DialogTitle>
        <DialogContent>
          {progressError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {progressError}
            </Alert>
          )}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {progressCurrent} / {progressTotal}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0}
            />
          </Box>
          {progressItems.length > 0 && (
            <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
              {progressItems.map((item) => (
                <ListItem key={item.categoryId} divider>
                  <ListItemText
                    primary={item.categoryName}
                    secondary={
                      item.error
                        ? `${item.status}: ${item.error}`
                        : `${item.status}${item.creditsUsed ? ` (${item.creditsUsed} token)` : ''}`
                    }
                    primaryTypographyProps={{
                      color:
                        item.status === 'failed' || item.status === 'sync_failed'
                          ? 'error'
                          : item.status === 'generated' || item.status === 'synced'
                            ? 'success.main'
                            : 'text.primary'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {progressDone && !progressError && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Művelet befejezve.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setProgressDialogOpen(false)}
            disabled={isGenerating || isSyncing}
          >
            {isGenerating || isSyncing ? 'Folyamatban...' : 'Bezárás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

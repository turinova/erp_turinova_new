'use client'

import React, { useState, useMemo } from 'react'
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
  Link as MuiLink
} from '@mui/material'
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Category as CategoryIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'

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
  shoprenter_category_descriptions?: Array<{
    name: string
    language_id: string
  }>
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

export default function CategoriesTable({
  initialCategories,
  connections,
  initialConnectionId,
  initialSearch
}: CategoriesTableProps) {
  const router = useRouter()
  const [categories] = useState<Category[]>(initialCategories)
  const [selectedConnectionId, setSelectedConnectionId] = useState(initialConnectionId)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Build tree structure from flat categories
  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, CategoryTreeNode>()
    const rootCategories: CategoryTreeNode[] = []

    // First pass: create all nodes
    categories.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
        level: 0
      })
    })

    // Second pass: build tree structure
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)!
      if (cat.parent_category_id && categoryMap.has(cat.parent_category_id)) {
        const parent = categoryMap.get(cat.parent_category_id)!
        parent.children.push(node)
        node.level = parent.level + 1
      } else {
        rootCategories.push(node)
      }
    })

    // Sort children by sort_order or name
    const sortChildren = (nodes: CategoryTreeNode[]) => {
      nodes.sort((a, b) => {
        // First by sort_order if available
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
          return a.sort_order - b.sort_order
        }
        // Then by name
        const nameA = a.name || a.shoprenter_category_descriptions?.[0]?.name || ''
        const nameB = b.name || b.shoprenter_category_descriptions?.[0]?.name || ''
        return nameA.localeCompare(nameB, 'hu')
      })
      nodes.forEach(node => sortChildren(node.children))
    }

    sortChildren(rootCategories)
    return rootCategories
  }, [categories])

  // Flatten tree for display (respecting expanded state)
  const flattenTree = (nodes: CategoryTreeNode[], level: number = 0): CategoryTreeNode[] => {
    const result: CategoryTreeNode[] = []
    nodes.forEach(node => {
      node.level = level
      result.push(node)
      if (expandedCategories.has(node.id) && node.children.length > 0) {
        result.push(...flattenTree(node.children, level + 1))
      }
    })
    return result
  }

  // Filter categories based on search term
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) {
      return categoryTree
    }

    const searchLower = searchTerm.toLowerCase()
    const filterNode = (node: CategoryTreeNode): CategoryTreeNode | null => {
      const name = node.name || node.shoprenter_category_descriptions?.[0]?.name || ''
      const matches = name.toLowerCase().includes(searchLower) ||
                     node.shoprenter_id.toLowerCase().includes(searchLower)

      const filteredChildren = node.children
        .map(child => filterNode(child))
        .filter((child): child is CategoryTreeNode => child !== null)

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        }
      }
      return null
    }

    return categoryTree
      .map(node => filterNode(node))
      .filter((node): node is CategoryTreeNode => node !== null)
  }, [categoryTree, searchTerm])

  const displayedCategories = flattenTree(filteredTree)

  // Toggle expand/collapse
  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Extract slug from URL
  const extractSlug = (url: string | null): string => {
    if (!url) return ''
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      return path.replace(/^\//, '') || ''
    } catch {
      return url.replace(/^https?:\/\/[^\/]+\//, '') || ''
    }
  }

  // Translate sync status to Hungarian
  const translateSyncStatus = (status: string): string => {
    const translations: Record<string, string> = {
      'synced': 'Szinkronizálva',
      'pending': 'Függőben',
      'error': 'Hiba'
    }
    return translations[status] || status
  }

  const getSyncStatusColor = (status: string): 'success' | 'error' | 'default' => {
    if (status === 'synced') return 'success'
    if (status === 'error') return 'error'
    return 'default'
  }

  // Handle connection change
  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnectionId(connectionId)
    router.push(`/categories?connectionId=${connectionId}&search=${encodeURIComponent(searchTerm)}`)
  }

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    router.push(`/categories?connectionId=${selectedConnectionId}&search=${encodeURIComponent(value)}`)
  }

  const shoprenterConnections = connections.filter(c => c.connection_type === 'shoprenter')

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Kategóriák kezelése
        </Typography>
        {shoprenterConnections.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Kapcsolat</InputLabel>
            <Select
              value={selectedConnectionId}
              label="Kapcsolat"
              onChange={(e) => handleConnectionChange(e.target.value)}
            >
              {shoprenterConnections.map(conn => (
                <MenuItem key={conn.id} value={conn.id}>
                  {conn.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés kategória neve vagy ID szerint..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '40%' }}>Név</TableCell>
              <TableCell sx={{ width: '12%' }}>Státusz</TableCell>
              <TableCell sx={{ width: '15%' }}>Szinkronizálás</TableCell>
              <TableCell sx={{ width: '20%' }}>URL</TableCell>
              <TableCell sx={{ width: '8%' }} align="right">Műveletek</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
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
                const categoryName = category.name || 
                                   category.shoprenter_category_descriptions?.[0]?.name || 
                                   'Névtelen kategória'
                const hasChildren = category.children.length > 0
                const isExpanded = expandedCategories.has(category.id)
                const slug = extractSlug(category.category_url)
                
                return (
                  <TableRow 
                    key={category.id} 
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {/* Indentation for hierarchy */}
                        <Box sx={{ width: category.level * 24, display: 'inline-block' }} />
                        
                        {/* Expand/collapse icon */}
                        {hasChildren ? (
                          <IconButton
                            size="small"
                            onClick={() => toggleExpand(category.id)}
                            sx={{ 
                              p: 0.5,
                              minWidth: 'auto',
                              width: 24,
                              height: 24
                            }}
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
                        
                        {/* Category icon */}
                        {hasChildren ? (
                          isExpanded ? (
                            <FolderOpenIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
                          ) : (
                            <FolderIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
                          )
                        ) : (
                          <CategoryIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5, ml: 0.5 }} />
                        )}
                        
                        {/* Category name */}
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
                          sx={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.75rem',
                            color: 'text.secondary'
                          }}
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
                          sx={{ 
                            width: 32,
                            height: 32
                          }}
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
    </Box>
  )
}

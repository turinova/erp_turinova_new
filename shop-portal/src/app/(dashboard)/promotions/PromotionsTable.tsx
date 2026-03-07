'use client'

import React, { useState } from 'react'
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
  Chip,
  Link,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  LocalOffer as LocalOfferIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'

interface Promotion {
  id: string
  priority: number
  price: number
  date_from: string | null
  date_to: string | null
  min_quantity: number
  max_quantity: number
  type: 'interval' | 'day_spec'
  day_of_week: number | null
  is_active: boolean
  is_expired: boolean
  shoprenter_special_id: string | null
  created_at: string
  updated_at: string
  shoprenter_products: {
    id: string
    name: string
    sku: string
    shoprenter_id: string | null
  } | null
  customer_groups: {
    id: string
    name: string
    code: string
  } | null
}

interface PromotionsTableProps {
  initialPromotions: Promotion[]
}

const DAYS_OF_WEEK = [
  'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'
]

export default function PromotionsTable({ initialPromotions }: PromotionsTableProps) {
  const [promotions] = useState<Promotion[]>(initialPromotions)
  const router = useRouter()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('hu-HU')
  }

  const getStatusChip = (promo: Promotion) => {
    if (!promo.is_active) {
      return <Chip label="Inaktív" size="small" color="default" />
    }
    if (promo.is_expired) {
      return <Chip label="Lejárt" size="small" color="error" />
    }
    const now = new Date()
    const dateFrom = promo.date_from ? new Date(promo.date_from) : null
    const dateTo = promo.date_to ? new Date(promo.date_to) : null
    
    if (dateFrom && now < dateFrom) {
      return <Chip label="Később aktív" size="small" color="warning" />
    }
    if (dateTo && now > dateTo) {
      return <Chip label="Lejárt" size="small" color="error" />
    }
    return <Chip label="Aktív" size="small" color="success" />
  }

  const activePromotions = promotions.filter(p => p.is_active && !p.is_expired)
  const inactivePromotions = promotions.filter(p => !p.is_active || p.is_expired)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Akciók kezelése
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Itt láthatja az összes termék akcióját és mennyiségi árazását. Az akciók szerkesztéséhez nyissa meg a termék oldalt.
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Fontos információk az akciókról:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Az akciók <strong>termékekhez</strong> kapcsolódnak</li>
            <li>Az akciók szerkesztéséhez nyissa meg a <strong>termék oldalt</strong></li>
            <li>A <strong>prioritás</strong> határozza meg, hogy melyik akció érvényesül, ha több akció is érvényes</li>
            <li>A <strong>mennyiségi árazás</strong> esetén a min/max mennyiség határozza meg az érvényességet</li>
            <li>Az akciók automatikusan szinkronizálódnak a ShopRenter-be a termék szinkronizálásakor</li>
          </ul>
        </Typography>
      </Alert>

      {/* Active Promotions */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 3 }}>
        Aktív akciók ({activePromotions.length})
      </Typography>
      <TableContainer component={Paper} elevation={2} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Termék</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Ár</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Prioritás</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Időszak</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Mennyiség</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Típus</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1 }}>Művelet</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activePromotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <LocalOfferIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                    <Typography variant="body1" color="text.secondary">
                      Nincs aktív akció
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              activePromotions.map((promo) => (
                <TableRow key={promo.id} hover sx={{ '& td': { py: 1 } }}>
                  <TableCell sx={{ py: 1 }}>
                    {promo.shoprenter_products ? (
                      <Box>
                        <Link
                          component={NextLink}
                          href={`/products/${promo.shoprenter_products.id}`}
                          sx={{ fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {promo.shoprenter_products.name}
                        </Link>
                        <Typography variant="caption" color="text.secondary" display="block">
                          SKU: {promo.shoprenter_products.sku}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Termék törölve
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {formatPrice(promo.price)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      label={promo.priority === -1 ? 'Nap terméke' : promo.priority}
                      size="small"
                      color={promo.priority === -1 ? 'warning' : 'primary'}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {promo.customer_groups ? (
                      <Chip
                        label={promo.customer_groups.name}
                        size="small"
                        color="secondary"
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Mindenki
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2">
                      {formatDate(promo.date_from)} - {formatDate(promo.date_to)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {promo.min_quantity > 0 || promo.max_quantity > 0 ? (
                      <Typography variant="body2">
                        {promo.min_quantity > 0 ? `${promo.min_quantity}+` : '0'} 
                        {promo.max_quantity > 0 ? ` - ${promo.max_quantity}` : '+'}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Nincs korlát
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {promo.type === 'day_spec' ? (
                      <Tooltip title={`${DAYS_OF_WEEK[(promo.day_of_week || 1) - 1]} terméke`}>
                        <Chip
                          label="Nap terméke"
                          size="small"
                          color="warning"
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="body2">
                        Intervallum
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {getStatusChip(promo)}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {promo.shoprenter_products && (
                      <Tooltip title="Termék megnyitása">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/products/${promo.shoprenter_products!.id}`)}
                          color="primary"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Inactive/Expired Promotions */}
      {inactivePromotions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Inaktív / Lejárt akciók ({inactivePromotions.length})
          </Typography>
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Termék</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Ár</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Prioritás</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Vevőcsoport</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Időszak</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Státusz</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 1 }}>Művelet</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inactivePromotions.map((promo) => (
                  <TableRow key={promo.id} hover sx={{ '& td': { py: 1 }, opacity: 0.7 }}>
                    <TableCell sx={{ py: 1 }}>
                      {promo.shoprenter_products ? (
                        <Box>
                          <Link
                            component={NextLink}
                            href={`/products/${promo.shoprenter_products.id}`}
                            sx={{ fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {promo.shoprenter_products.name}
                          </Link>
                          <Typography variant="caption" color="text.secondary" display="block">
                            SKU: {promo.shoprenter_products.sku}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Termék törölve
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatPrice(promo.price)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Chip
                        label={promo.priority === -1 ? 'Nap terméke' : promo.priority}
                        size="small"
                        color="default"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {promo.customer_groups ? (
                        <Chip
                          label={promo.customer_groups.name}
                          size="small"
                          color="default"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Mindenki
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2">
                        {formatDate(promo.date_from)} - {formatDate(promo.date_to)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {getStatusChip(promo)}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {promo.shoprenter_products && (
                        <Tooltip title="Termék megnyitása">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/products/${promo.shoprenter_products!.id}`)}
                            color="primary"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  )
}

'use client'

import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Alert
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Store as StoreIcon,
  Inventory as InventoryIcon,
  LocalOffer as LocalOfferIcon,
  Label as LabelIcon,
  Category as CategoryIcon,
  AccountTree as AccountTreeIcon,
  AttachMoney as AttachMoneyIcon,
  Description as DescriptionIcon
} from '@mui/icons-material'
import type { WebshopConnection } from '@/lib/connections-server'

interface Step8ReviewCreateProps {
  data: {
    connection_id: string | null
    sku: string
    name: string
    model_number: string
    gtin: string
    product_class_shoprenter_id: string | null
    product_attributes: any[] | null
    category_ids: string[]
    parent_product_id: string | null
    cost: string
    multiplier: string
    vat_id: string | null
    short_description: string
    description: string
    meta_title: string
    meta_description: string
    url_slug: string
  }
  connections: WebshopConnection[]
}

export default function Step8ReviewCreate({
  data,
  connections
}: Step8ReviewCreateProps) {
  const connection = connections.find(c => c.id === data.connection_id)
  const attributes = Array.isArray(data.product_attributes) ? data.product_attributes : (data.product_attributes ? [data.product_attributes] : [])

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <CheckCircleIcon sx={{ color: '#757575', fontSize: '32px' }} />
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#424242' }}>
          Áttekintés
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Basic Information */}
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#e0e0e0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <InventoryIcon sx={{ color: '#757575', fontSize: '20px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Alapadatok
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Kapcsolat
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {connection?.name || 'Ismeretlen'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                SKU
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                {data.sku}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Termék neve
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {data.name}
              </Typography>
            </Box>
              {data.model_number && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Gyártói cikkszám
                </Typography>
                <Typography variant="body2">
                  {data.model_number}
                </Typography>
              </Box>
              )}
              {data.gtin && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Vonalkód
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {data.gtin}
                </Typography>
              </Box>
              )}
          </Box>
          </Paper>

        {/* Product Class */}
        {data.product_class_shoprenter_id && (
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#90caf9', borderRadius: 2, bgcolor: '#f5f9ff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LocalOfferIcon sx={{ color: '#2196f3', fontSize: '20px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1565c0' }}>
                Termék típusa
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#1565c0' }}>
              Kiválasztva
            </Typography>
          </Paper>
        )}

        {/* Attributes */}
        {attributes.length > 0 && (
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#a5d6a7', borderRadius: 2, bgcolor: '#f1f8f4' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LabelIcon sx={{ color: '#4caf50', fontSize: '20px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                Attribútumok
            </Typography>
              <Chip label={attributes.length} size="small" sx={{ bgcolor: '#4caf50', color: 'white', height: '20px', fontSize: '0.7rem' }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {attributes.map((attr: any, index: number) => {
                const displayName = attr.display_name || attr.name || 'Ismeretlen'
                let displayValue: string = 'Nincs érték'
                
                if (attr.value !== null && attr.value !== undefined && attr.value !== '') {
                  if (attr.type === 'LIST') {
                    displayValue = attr.listAttributeValueDisplay || attr.value || String(attr.listAttributeValueId || 'Nincs érték')
                  } else {
                    displayValue = String(attr.value)
                  }
                }

                return (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {displayName}:
            </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32' }}>
                      {displayValue}
            </Typography>
                  </Box>
                )
              })}
            </Box>
          </Paper>
        )}

        {/* Categories */}
        {data.category_ids.length > 0 && (
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#ffcc80', borderRadius: 2, bgcolor: '#fff8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CategoryIcon sx={{ color: '#ff9800', fontSize: '20px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e65100' }}>
              Kategóriák
              </Typography>
              <Chip label={data.category_ids.length} size="small" sx={{ bgcolor: '#ff9800', color: 'white', height: '20px', fontSize: '0.7rem' }} />
            </Box>
            <Typography variant="body2" sx={{ color: '#e65100' }}>
              {data.category_ids.length} kategória kiválasztva
            </Typography>
          </Paper>
        )}

        {/* Pricing */}
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#a5d6a7', borderRadius: 2, bgcolor: '#f1f8f4' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AttachMoneyIcon sx={{ color: '#4caf50', fontSize: '20px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
              Árazás
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Beszerzési ár:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {parseFloat(data.cost || '0').toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ft
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Szorzó:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {parseFloat(data.multiplier || '1.0').toFixed(3)}x
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                Nettó ár:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#1b5e20' }}>
                {((parseFloat(data.cost || '0') * parseFloat(data.multiplier || '1.0'))).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ft
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Parent Product */}
              {data.parent_product_id && (
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#ce93d8', borderRadius: 2, bgcolor: '#faf5fc' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccountTreeIcon sx={{ color: '#9c27b0', fontSize: '20px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#7b1fa2' }}>
                Szülő termék
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#7b1fa2' }}>
              Szülő termék kiválasztva
                </Typography>
            </Paper>
        )}

        {/* Content & SEO */}
        {(data.short_description || data.description || data.meta_title || data.meta_description || data.url_slug) && (
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: '#80cbc4', borderRadius: 2, bgcolor: '#f0f9f8' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DescriptionIcon sx={{ color: '#009688', fontSize: '20px' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#00695c' }}>
                Tartalom & SEO
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {data.short_description && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Rövid leírás
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#00695c' }}>
                    {data.short_description.length > 150 ? `${data.short_description.substring(0, 150)}...` : data.short_description}
                </Typography>
                </Box>
              )}
              {data.meta_title && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Meta cím
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#00695c', fontWeight: 500 }}>
                    {data.meta_title}
                </Typography>
                </Box>
              )}
              {data.meta_description && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Meta leírás
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#00695c' }}>
                    {data.meta_description.length > 150 ? `${data.meta_description.substring(0, 150)}...` : data.meta_description}
                  </Typography>
                </Box>
              )}
              {data.url_slug && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    URL slug
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#00695c', fontFamily: 'monospace' }}>
                    {data.url_slug}
                </Typography>
                </Box>
              )}
            </Box>
            </Paper>
        )}
      </Box>

      <Alert
        severity="info"
        icon={<CheckCircleIcon />}
        sx={{ mt: 3, borderRadius: 2 }}
      >
        <Typography variant="body2">
          A termék létrehozása után <strong>pending</strong> státuszban lesz. 
          A webshopba való szinkronizálást a termék szerkesztése oldalon végezheti el.
        </Typography>
      </Alert>
    </Box>
  )
}

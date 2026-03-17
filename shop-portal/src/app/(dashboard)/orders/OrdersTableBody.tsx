'use client'

import {
  Box,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  Chip,
  Checkbox,
  Link,
  Tooltip
} from '@mui/material'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import OrderSourceCell from './OrderSourceCell'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  getFulfillabilityDisplayStyle
} from '@/lib/order-status'
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Függőben',
  partial: 'Részben',
  paid: 'Fizetve',
  refunded: 'Visszatérítve'
}

const METHOD_CHIP_PALETTE = [
  { bgcolor: 'rgba(25, 118, 210, 0.12)', color: '#1565c0', borderColor: 'rgba(25, 118, 210, 0.35)' },
  { bgcolor: 'rgba(94, 53, 177, 0.12)', color: '#5e35b1', borderColor: 'rgba(94, 53, 177, 0.35)' },
  { bgcolor: 'rgba(0, 121, 107, 0.12)', color: '#00695c', borderColor: 'rgba(0, 121, 107, 0.35)' },
  { bgcolor: 'rgba(230, 81, 0, 0.12)', color: '#e65100', borderColor: 'rgba(230, 81, 0, 0.35)' },
  { bgcolor: 'rgba(121, 85, 72, 0.12)', color: '#5d4037', borderColor: 'rgba(121, 85, 72, 0.35)' },
  { bgcolor: 'rgba(26, 35, 126, 0.12)', color: '#1a237e', borderColor: 'rgba(26, 35, 126, 0.35)' }
]

function chipStyleForMethod(value: string): (typeof METHOD_CHIP_PALETTE)[0] {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash) + value.charCodeAt(i)
  return METHOD_CHIP_PALETTE[Math.abs(hash) % METHOD_CHIP_PALETTE.length]
}

function formatCurrency(amount: number | null, currency: string = 'HUF') {
  if (amount == null) return '-'
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export interface OrderRow {
  id: string
  order_number: string
  platform_order_id?: string | null
  connection_id?: string | null
  customer_firstname?: string
  customer_lastname?: string
  customer_email?: string | null
  total_gross?: number | null
  currency_code?: string
  status?: string
  fulfillability_status?: string | null
  payment_status?: string
  shipping_method_name?: string | null
  payment_method_name?: string | null
  order_date?: string | null
}

interface OrdersTableBodyProps {
  orders: OrderRow[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  batchByOrderId?: Record<string, { id: string; code: string }>
}

export default function OrdersTableBody({ orders, selectedIds, onToggleSelect, batchByOrderId = {} }: OrdersTableBodyProps) {
  const router = useRouter()

  if (orders.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
            Nincs megjeleníthető rendelés.
          </TableCell>
        </TableRow>
      </TableBody>
    )
  }

  function FulfillabilityIcon({ label }: { label: string }) {
    if (label === 'Csomagolható') return <CheckCircleIcon sx={{ fontSize: 16 }} />
    if (label === 'Hiány') return <ErrorIcon sx={{ fontSize: 16 }} />
    if (label === 'Beszerzés alatt') return <LocalShippingIcon sx={{ fontSize: 16 }} />
    return <ScheduleIcon sx={{ fontSize: 16 }} />
  }

  return (
    <TableBody>
      {orders.map((order: OrderRow) => {
        const isNew = order.status === 'new'
        const fulfillStyle = isNew ? getFulfillabilityDisplayStyle(order.fulfillability_status) : null
        const rowBg = isNew && fulfillStyle ? fulfillStyle.rowBg : undefined
        const rowBgHover = isNew && fulfillStyle ? fulfillStyle.rowBgHover : undefined
        return (
        <TableRow
          key={order.id}
          hover
          sx={{
            cursor: 'pointer',
            bgcolor: rowBg,
            '&:hover': { bgcolor: rowBgHover ?? 'action.hover' },
            '& td': { borderBottom: 1, borderColor: 'divider' }
          }}
          onClick={() => router.push(`/orders/${order.id}`)}
        >
          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              size="small"
              checked={selectedIds.has(order.id)}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(order.id) }}
            />
          </TableCell>
          <TableCell>
            <Link component={NextLink} href={`/orders/${order.id}`} fontWeight="medium" onClick={(e) => e.stopPropagation()}>
              {order.order_number}
            </Link>
          </TableCell>
          <TableCell>
            {order.customer_firstname} {order.customer_lastname}
            {order.customer_email && (
              <Typography variant="caption" display="block" color="text.secondary">
                {order.customer_email}
              </Typography>
            )}
          </TableCell>
          <TableCell>
            <OrderSourceCell
              connectionId={order.connection_id ?? null}
              platformOrderId={order.platform_order_id ?? null}
            />
          </TableCell>
          <TableCell>{formatCurrency(order.total_gross ?? null, order.currency_code)}</TableCell>
          <TableCell>
            {batchByOrderId[order.id] ? (
              <Link component={NextLink} href={`/pick-batches/${batchByOrderId[order.id].id}`} onClick={(e) => e.stopPropagation()} variant="body2">
                {batchByOrderId[order.id].code}
              </Link>
            ) : (
              '—'
            )}
          </TableCell>
          <TableCell>
            {isNew && fulfillStyle ? (
              <Tooltip title={`Új · ${fulfillStyle.label}`}>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    border: '1px solid',
                    padding: '2px 8px',
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    ...fulfillStyle.chipStyle,
                    '&:hover': { opacity: 0.92 }
                  }}
                >
                  <FulfillabilityIcon label={fulfillStyle.label} />
                  {fulfillStyle.label}
                </Box>
              </Tooltip>
            ) : (
              <Chip
                size="small"
                label={ORDER_STATUS_LABELS[order.status ?? ''] || order.status}
                color={ORDER_STATUS_COLORS[order.status ?? ''] || 'default'}
                variant="outlined"
              />
            )}
          </TableCell>
          <TableCell>
            <Chip
              size="small"
              label={PAYMENT_STATUS_LABELS[order.payment_status ?? ''] || order.payment_status || 'Függőben'}
              variant="outlined"
            />
          </TableCell>
          <TableCell sx={{ maxWidth: 100 }}>
            {order.shipping_method_name ? (
              <Tooltip title={order.shipping_method_name}>
                <Chip
                  size="small"
                  label={order.shipping_method_name}
                  sx={{
                    height: 22,
                    maxWidth: '100%',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid',
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    },
                    ...chipStyleForMethod(order.shipping_method_name)
                  }}
                />
              </Tooltip>
            ) : (
              <Typography variant="body2" color="text.secondary">—</Typography>
            )}
          </TableCell>
          <TableCell sx={{ maxWidth: 100 }}>
            {order.payment_method_name ? (
              <Tooltip title={order.payment_method_name}>
                <Chip
                  size="small"
                  label={order.payment_method_name}
                  sx={{
                    height: 22,
                    maxWidth: '100%',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid',
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    },
                    ...chipStyleForMethod(order.payment_method_name)
                  }}
                />
              </Tooltip>
            ) : (
              <Typography variant="body2" color="text.secondary">—</Typography>
            )}
          </TableCell>
          <TableCell>{formatDate(order.order_date ?? null)}</TableCell>
        </TableRow>
        );
      })}
    </TableBody>
  )
}

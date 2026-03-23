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
  Tooltip,
  Button
} from '@mui/material'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import OrderSourceCell from './OrderSourceCell'
import {
  ORDER_STATUS_COLORS,
  getFulfillabilityDisplayStyle,
  getOrderStatusLabel
} from '@/lib/order-status'
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  LocalShipping as LocalShippingIcon,
  Payments as PaymentsIcon,
  DoneAll as DoneAllIcon,
  Autorenew as AutorenewIcon,
  Undo as UndoIcon
} from '@mui/icons-material'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Függőben',
  partial: 'Részben',
  paid: 'Fizetve',
  refunded: 'Visszatérítve'
}

const PAYMENT_STATUS_DISPLAY_STYLE: Record<
  string,
  { chipStyle: { bgcolor: string; color: string; borderColor: string }; icon: React.ElementType }
> = {
  pending: {
    chipStyle: { bgcolor: '#FFF8E1', color: '#7A5D00', borderColor: '#FFE082' },
    icon: ScheduleIcon
  },
  partial: {
    chipStyle: { bgcolor: '#E3F2FD', color: '#0D47A1', borderColor: '#90CAF9' },
    icon: PaymentsIcon
  },
  paid: {
    chipStyle: { bgcolor: '#E8F5E9', color: '#1B5E20', borderColor: '#A5D6A7' },
    icon: DoneAllIcon
  },
  refunded: {
    chipStyle: { bgcolor: '#F3E5F5', color: '#4A148C', borderColor: '#CE93D8' },
    icon: UndoIcon
  }
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

function formatOrderDateShort(dateString: string | null) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatOrderDateFull(dateString: string | null) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
  hasActiveFilters?: boolean
}

function MethodChip({
  value,
  compact
}: {
  value: string
  compact?: boolean
}) {
  return (
    <Chip
      size="small"
      label={value}
      sx={{
        height: compact ? 20 : 22,
        maxWidth: '100%',
        fontSize: '0.7rem',
        fontWeight: 500,
        border: '1px solid',
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          px: 0.75
        },
        ...chipStyleForMethod(value)
      }}
    />
  )
}

export default function OrdersTableBody({
  orders,
  selectedIds,
  onToggleSelect,
  batchByOrderId = {},
  hasActiveFilters = false
}: OrdersTableBodyProps) {
  const router = useRouter()
  const tableColSpan = 9

  if (orders.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={tableColSpan} align="center" sx={{ py: 5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 480, mx: 'auto' }}>
              <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                {hasActiveFilters
                  ? 'Nincs a szűrőknek megfelelő rendelés.'
                  : 'Még nincs megjeleníthető rendelés.'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {hasActiveFilters
                  ? 'Próbáljon más státuszt vagy keresési feltételt, vagy törölje a szűrőket.'
                  : 'Az új webshopos rendelések a rendelés pufferben jelennek meg, onnan feldolgozva kerülnek ide.'}
              </Typography>
              {!hasActiveFilters && (
                <Button component={NextLink} href="/orders/buffer" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Rendelés puffer megnyitása
                </Button>
              )}
            </Box>
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

        // Secondary navigation inside the status cell: "next operational hub".
        const status = (order.status ?? '').trim()
        let nextHref: string | null = null

        if (status === 'picking') {
          const b = batchByOrderId[order.id]
          if (b) {
            nextHref = `/pick-batches/${b.id}`
          }
        } else if (status === 'picked' || status === 'verifying' || status === 'packing') {
          nextHref = '/pack'
        } else if (status === 'awaiting_carrier' || status === 'ready_for_pickup') {
          nextHref = '/dispatch'
        }
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
          <TableCell sx={{ maxWidth: 200 }}>
            {(() => {
              const customerName =
                `${(order.customer_firstname || '').trim()} ${(order.customer_lastname || '').trim()}`.trim() || '—'
              const email = (order.customer_email || '').trim()
              const titleNode =
                email && customerName !== '—' ? (
                  <>
                    {customerName}
                    <br />
                    <Typography component="span" variant="caption" sx={{ color: 'inherit', opacity: 0.9 }}>
                      {email}
                    </Typography>
                  </>
                ) : email ? (
                  email
                ) : (
                  customerName
                )
              return (
                <Tooltip title={titleNode} placement="top" enterDelay={400}>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default'
                    }}
                  >
                    {customerName}
                  </Typography>
                </Tooltip>
              )
            })()}
          </TableCell>
          <TableCell>
            <OrderSourceCell
              connectionId={order.connection_id ?? null}
              platformOrderId={order.platform_order_id ?? null}
            />
          </TableCell>
          <TableCell>{formatCurrency(order.total_gross ?? null, order.currency_code)}</TableCell>
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
              (() => {
                const baseLabel = getOrderStatusLabel(order.status, {
                  shippingMethodName: order.shipping_method_name
                })

                const chipNode = (
                  <Chip
                    size="small"
                    label={baseLabel}
                    color={ORDER_STATUS_COLORS[order.status ?? ''] || 'default'}
                    variant="outlined"
                  />
                )

                if (nextHref) {
                  return (
                    <Link
                      component={NextLink}
                      href={nextHref}
                      onClick={(e) => e.stopPropagation()}
                      underline="none"
                      sx={{ display: 'inline-flex', alignItems: 'center' }}
                    >
                      {chipNode}
                    </Link>
                  )
                }

                return chipNode
              })()
            )}
          </TableCell>
          <TableCell>
            {(() => {
              const key = String(order.payment_status || 'pending').trim()
              const style = PAYMENT_STATUS_DISPLAY_STYLE[key] || PAYMENT_STATUS_DISPLAY_STYLE.pending
              const Icon = style.icon
              const label = PAYMENT_STATUS_LABELS[key] || key || 'Függőben'
              return (
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
                    ...style.chipStyle
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                  {label}
                </Box>
              )
            })()}
          </TableCell>
          <TableCell sx={{ maxWidth: 160, verticalAlign: 'top' }}>
            {(() => {
              const ship = order.shipping_method_name?.trim()
              const pay = order.payment_method_name?.trim()
              if (!ship && !pay) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )
              }
              const tipLines: string[] = []
              if (ship) tipLines.push(`Szállítás: ${ship}`)
              if (pay) tipLines.push(`Fizetés: ${pay}`)
              const tip = tipLines.join('\n')
              return (
                <Tooltip
                  title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}
                  placement="top"
                  enterDelay={300}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start', py: 0.25 }}>
                    {ship ? <MethodChip value={ship} compact /> : null}
                    {pay ? <MethodChip value={pay} compact /> : null}
                  </Box>
                </Tooltip>
              )
            })()}
          </TableCell>
          <TableCell>
            {order.order_date ? (
              <Tooltip title={formatOrderDateFull(order.order_date)} placement="top" enterDelay={300}>
                <Typography variant="body2" component="span" sx={{ cursor: 'default' }}>
                  {formatOrderDateShort(order.order_date)}
                </Typography>
              </Tooltip>
            ) : (
              '—'
            )}
          </TableCell>
        </TableRow>
        );
      })}
    </TableBody>
  )
}

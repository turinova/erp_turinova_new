'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Typography,
  Box
} from '@mui/material'
import { Sms as SmsIcon } from '@mui/icons-material'

interface SmsEligibleOrder {
  order_id: string
  order_number: string
  customer_name: string
  customer_mobile: string
  total_price_formatted: string
}

interface BeszerzésSmsModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (selectedOrderIds: string[]) => Promise<void>
  orders: SmsEligibleOrder[]
  isProcessing?: boolean
}

export default function BeszerzésSmsModal({
  open,
  onClose,
  onConfirm,
  orders,
  isProcessing = false
}: BeszerzésSmsModalProps) {
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(
    orders.map(o => o.order_id)
  )

  // Update selected orders when orders prop changes
  React.useEffect(() => {
    setSelectedOrderIds(orders.map(o => o.order_id))
  }, [orders])

  const handleToggleOrder = (orderId: string, event?: React.MouseEvent) => {
    if (isProcessing) return
    
    // Stop event propagation to prevent row click from triggering
    if (event) {
      event.stopPropagation()
    }
    
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const handleConfirm = async () => {
    // Allow confirmation even with 0 selected (will skip SMS, just update status)
    await onConfirm(selectedOrderIds)
  }

  const handleCancel = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isProcessing}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmsIcon color="info" />
        Beszerzés SMS küldése
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A következő ügyfelek SMS-t kapnak a beszerzésükről. <strong>Minden termék beérkezett.</strong>
          <br />
          Töröld a pipát, ha nem szeretnéd elküldeni az SMS-t egy adott ügyfélnek.
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 50 }}>
                  <Checkbox
                    checked={selectedOrderIds.length === orders.length && orders.length > 0}
                    indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(orders.map(o => o.order_id))
                      } else {
                        setSelectedOrderIds([])
                      }
                    }}
                    disabled={isProcessing}
                  />
                </TableCell>
                <TableCell><strong>Ügyfél neve</strong></TableCell>
                <TableCell><strong>Telefonszám</strong></TableCell>
                <TableCell align="right"><strong>Végösszeg</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.order_id}
                  hover
                  onClick={() => handleToggleOrder(order.order_id)}
                  sx={{ cursor: isProcessing ? 'default' : 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.order_id)}
                      onChange={(e) => handleToggleOrder(order.order_id, e as any)}
                      disabled={isProcessing}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {order.customer_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.order_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {order.customer_mobile}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {order.total_price_formatted}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {orders.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Nincs SMS-re jogosult beszerzés
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={isProcessing}
          variant="outlined"
        >
          Mégse
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isProcessing}
          variant="contained"
          color="primary"
          startIcon={<SmsIcon />}
        >
          {isProcessing
            ? 'Feldolgozás...'
            : selectedOrderIds.length === 0
              ? 'Folytatás SMS nélkül'
              : `SMS küldés (${selectedOrderIds.length} kiválasztva)`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}


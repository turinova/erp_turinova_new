'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box
} from '@mui/material'

interface OrderPaymentInfo {
  id: string
  order_number: string
  customer_name: string
  remaining_balance: number
}

interface PaymentConfirmationModalProps {
  open: boolean
  orders: OrderPaymentInfo[]
  onConfirm: (createPayments: boolean) => void
  onClose: () => void
}

export default function PaymentConfirmationModal({
  open,
  orders,
  onConfirm,
  onClose
}: PaymentConfirmationModalProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const totalRemaining = orders.reduce((sum, order) => sum + order.remaining_balance, 0)

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Fizetés teljesítve?
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {orders.length} megrendelés átadásra kerül
        </Typography>
      
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Megrendelés</strong></TableCell>
                <TableCell><strong>Ügyfél</strong></TableCell>
                <TableCell align="right"><strong>Hátralék</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell align="right">
                    <Typography 
                      variant="body2" 
                      color={order.remaining_balance > 0 ? 'error' : 'success'}
                      fontWeight="medium"
                    >
                      {formatCurrency(order.remaining_balance)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2}>
                  <strong>Összesen:</strong>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body1" fontWeight="bold" color={totalRemaining > 0 ? 'error' : 'success'}>
                    {formatCurrency(totalRemaining)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Igen:</strong> Automata fizetés kerül rögzítésre a hátralék összegére, majd a megrendelések lezárásra kerülnek.
            <br />
            <strong>Nem:</strong> A megrendelések lezárásra kerülnek fizetés rögzítése nélkül.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          size="large"
        >
          Mégse
        </Button>
        <Button 
          onClick={() => onConfirm(false)} 
          variant="outlined"
          color="warning"
          size="large"
        >
          Nem
        </Button>
        <Button 
          onClick={() => onConfirm(true)} 
          variant="contained"
          color="success"
          size="large"
          autoFocus
        >
          Igen
        </Button>
      </DialogActions>
    </Dialog>
  )
}


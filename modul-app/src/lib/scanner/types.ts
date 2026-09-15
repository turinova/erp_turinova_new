import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import type { QuoteStatus } from '@/lib/quotes/queries'

export type ScannerLookupOrder = {
  id: string
  order_number: string
  status: QuoteStatus
  payment_status: PaymentStatus
  final_total_gross: number
  total_paid: number
  currency: string
  customer_name: string
  barcode: string
  project_name: string | null
}

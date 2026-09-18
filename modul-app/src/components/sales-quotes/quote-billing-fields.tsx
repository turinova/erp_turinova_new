'use client'

/**
 * Árajánlat alias — közös DocumentBillingFields.
 * Meglévő importok ne törjenek.
 */
export {
  DocumentBillingFields as QuoteBillingFields,
  EMPTY_DOCUMENT_BILLING as EMPTY_QUOTE_BILLING,
  billingFromCustomer,
  billingHasAny,
  billingToFormInput,
  type DocumentBillingState as QuoteBillingState
} from '@/components/sales/document-billing-fields'

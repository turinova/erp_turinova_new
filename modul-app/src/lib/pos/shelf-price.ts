import { displayGrossFromStored } from '@/lib/accessories/parse'

/** Polcár (bruttó Ft) — tárolt price_gross előnyben nettó×ÁFA újraszámolás előtt. */
export function saleItemShelfGross(hit: {
  price_net: number
  tax_rate_percent: number
  price_gross?: number | null
}): number {
  return displayGrossFromStored(
    Number(hit.price_net) || 0,
    Number(hit.tax_rate_percent) || 0,
    hit.price_gross
  )
}

// Price Formatting Utilities for Material Pricing

/**
 * Format number with spaces as thousand separators
 * Example: 5000 → "5 000"
 */
export function formatPrice(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Format price with currency symbol (Ft)
 * Example: 5000 → "5 000 Ft"
 */
export function formatPriceWithCurrency(value: number): string {
  return `${formatPrice(value)} Ft`
}

/**
 * Calculate full board cost from dimensions and price per m²
 * @param length_mm - Board length in millimeters
 * @param width_mm - Board width in millimeters  
 * @param price_per_sqm - Price per square meter
 * @returns Total board cost
 */
export function calculateFullBoardCost(
  length_mm: number, 
  width_mm: number, 
  price_per_sqm: number
): number {
  const sqm = (length_mm * width_mm) / 1_000_000
  return sqm * price_per_sqm
}

/**
 * Format area in square meters
 * Example: 5.796 → "5.796 m²"
 */
export function formatArea(sqm: number): string {
  return `${sqm.toFixed(3)} m²`
}

/**
 * Calculate square meters from dimensions
 * @param length_mm - Length in millimeters
 * @param width_mm - Width in millimeters
 * @returns Area in square meters
 */
export function calculateSquareMeters(length_mm: number, width_mm: number): number {
  return (length_mm * width_mm) / 1_000_000
}

/**
 * Calculate gross price from net price and VAT percentage
 * @param netPrice - Net price (without VAT)
 * @param vatPercent - VAT percentage (e.g. 27 for 27%)
 * @returns Gross price (net + VAT)
 */
export function calculateGrossPrice(netPrice: number, vatPercent: number): number {
  return netPrice * (1 + vatPercent / 100)
}


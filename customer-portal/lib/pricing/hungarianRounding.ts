/**
 * Hungarian Rounding Rules Implementation
 * Based on: https://www.billingo.hu/tudastar/olvas/kerekites-szabalyai
 * 
 * For invoicing:
 * - Net amounts should be rounded to whole numbers
 * - VAT is calculated from rounded net amount
 * - Gross = rounded net + rounded VAT
 * 
 * For cash payments (0-9.99 range):
 * - 0.01-2.49 → round down to 0
 * - 2.50-4.99 → round up to 5
 * - 5.01-7.49 → round down to 5
 * - 7.50-9.99 → round up to 0 (next whole number)
 * 
 * For larger amounts, we round to nearest whole number using standard rounding rules.
 */

/**
 * Rounds a number to the nearest whole number using standard rounding
 * (0.5 rounds up, which is standard for invoicing)
 * 
 * @param amount - The amount to round
 * @returns Rounded amount to nearest whole number
 */
export function roundToWholeNumber(amount: number): number {
  return Math.round(amount)
}

/**
 * Rounds a number according to Hungarian cash payment rules
 * (for amounts in the 0-9.99 range)
 * 
 * @param amount - The amount to round (should be < 10)
 * @returns Rounded amount according to Hungarian rules
 */
export function roundHungarianCash(amount: number): number {
  const fractionalPart = amount % 1
  
  if (fractionalPart >= 0.01 && fractionalPart < 2.50) {
    // Round down to 0
    return Math.floor(amount)
  } else if (fractionalPart >= 2.50 && fractionalPart < 5.00) {
    // Round up to 5
    return Math.floor(amount) + 5
  } else if (fractionalPart >= 5.00 && fractionalPart < 7.50) {
    // Round down to 5
    return Math.floor(amount) - (Math.floor(amount) % 5) + 5
  } else {
    // Round up to next whole number (0)
    return Math.ceil(amount)
  }
}

/**
 * Converts gross amount to net amount, ensuring that when converted back
 * with rounding, it gives the original gross amount.
 * 
 * This solves the problem where:
 * - User enters gross: 26000
 * - Converts to net: 26000 / 1.27 = 20472.44... → rounds to 20472
 * - Converts back: 20472 * 1.27 = 25999.44... → rounds to 25999 (WRONG!)
 * 
 * Solution: Find the net value that, when converted back with rounding,
 * gives us the original gross.
 * 
 * Algorithm:
 * 1. Calculate approximate net: net = gross / (1 + vatRate)
 * 2. Try rounding net and check if round(net * (1 + vatRate)) = gross
 * 3. If not, try net+1, net-1, net+2, net-2, etc. until we find a match
 * 
 * @param grossAmount - The gross amount to convert
 * @param vatRate - VAT rate as decimal (e.g., 0.27 for 27%)
 * @returns Net amount that, when converted back, gives the original gross
 */
export function grossToNetPreservingGross(grossAmount: number, vatRate: number): number {
  // Calculate approximate net
  const approximateNet = grossAmount / (1 + vatRate)
  const roundedNet = roundToWholeNumber(approximateNet)
  
  // Check if this net value gives us the correct gross
  const calculatedGross = roundToWholeNumber(roundedNet * (1 + vatRate))
  if (calculatedGross === grossAmount) {
    return roundedNet
  }
  
  // Try nearby values (within ±5 should be enough for most cases)
  const maxOffset = 5
  for (let offset = 1; offset <= maxOffset; offset++) {
    // Try net + offset
    const netPlus = roundedNet + offset
    const grossPlus = roundToWholeNumber(netPlus * (1 + vatRate))
    if (grossPlus === grossAmount) {
      return netPlus
    }
    
    // Try net - offset
    const netMinus = roundedNet - offset
    if (netMinus >= 0) {
      const grossMinus = roundToWholeNumber(netMinus * (1 + vatRate))
      if (grossMinus === grossAmount) {
        return netMinus
      }
    }
  }
  
  // If we can't find an exact match, return the rounded approximate net
  // This should rarely happen, but it's a fallback
  return roundedNet
}

/**
 * Converts net amount to gross amount with proper rounding
 * 
 * @param netAmount - The net amount
 * @param vatRate - VAT rate as decimal (e.g., 0.27 for 27%)
 * @returns Rounded gross amount
 */
export function netToGross(netAmount: number, vatRate: number): number {
  const roundedNet = roundToWholeNumber(netAmount)
  const vatAmount = roundedNet * vatRate
  const roundedVat = roundToWholeNumber(vatAmount)
  const gross = roundedNet + roundedVat
  return roundToWholeNumber(gross)
}

/**
 * Calculates VAT amount from net amount with proper rounding
 * 
 * @param netAmount - The net amount
 * @param vatRate - VAT rate as decimal (e.g., 0.27 for 27%)
 * @returns Rounded VAT amount
 */
export function calculateVat(netAmount: number, vatRate: number): number {
  const roundedNet = roundToWholeNumber(netAmount)
  const vatAmount = roundedNet * vatRate
  return roundToWholeNumber(vatAmount)
}

/**
 * Calculates gross amount from net and VAT with proper rounding
 * 
 * @param netAmount - The net amount
 * @param vatAmount - The VAT amount
 * @returns Rounded gross amount
 */
export function calculateGross(netAmount: number, vatAmount: number): number {
  const roundedNet = roundToWholeNumber(netAmount)
  const roundedVat = roundToWholeNumber(vatAmount)
  return roundToWholeNumber(roundedNet + roundedVat)
}

# Edge Material Ráhagyás Calculation Fix

**Date:** January 27, 2025  
**Issue:** Edge material ráhagyás (overhang/allowance) was not being multiplied by panel quantity  
**Status:** ✅ Fixed  

## Problem Description

When calculating edge material pricing, the ráhagyás (overhang/allowance) was only being applied once per edge material type, instead of being multiplied by the panel quantity.

### Example Issue
- **Panel:** 1000x1000mm with quantity = 5
- **Edge Material:** With 50mm ráhagyás
- **Incorrect Calculation:** `5.00m + 50mm ráhagyás` (ráhagyás applied only once)
- **Correct Calculation:** `5.00m + 250mm ráhagyás` (50mm × 5 panels)

## Root Cause

In `src/lib/pricing/quoteCalculations.ts`, the `calculateEdgeMaterialPricing` function was using:

```typescript
// WRONG: Counted number of edge segments
const edgeCount = panelEdges.filter(e => e.edge_material_name === edgeId).length;
const overhangLengthMm = edgeCount * edgeInfo.overhang_mm;
```

This counted the number of edge segments (e.g., 1 edge A), not the total quantity of panels using that edge material.

## Solution

Changed the logic to count the total quantity of panels using each edge material:

```typescript
// CORRECT: Count total quantity of panels using this edge material
const totalQuantity = panelEdges
  .filter(e => e.edge_material_name === edgeId)
  .reduce((sum, e) => sum + e.quantity, 0);
const overhangLengthMm = totalQuantity * edgeInfo.overhang_mm;
```

## Technical Details

### File Modified
- `src/lib/pricing/quoteCalculations.ts`
- Function: `calculateEdgeMaterialPricing()`
- Lines: 388-394

### Logic Flow
1. **Edge Length Calculation:** ✅ Already correct - `panelEdge.length_mm * panelEdge.quantity`
2. **Ráhagyás Calculation:** ✅ Now fixed - `totalQuantity * edgeInfo.overhang_mm`
3. **Total Length:** `(totalLengthMm + overhangLengthMm) / 1000`

### Example Calculation
For a 1000x1000mm panel with quantity=5 and edge material with 50mm ráhagyás:

- **Edge Length:** 1000mm × 5 = 5000mm
- **Ráhagyás:** 50mm × 5 = 250mm
- **Total Length:** 5000mm + 250mm = 5250mm = 5.25m

## Impact

- ✅ Edge material pricing now correctly calculates ráhagyás per panel quantity
- ✅ Quote calculations show accurate edge material costs
- ✅ No breaking changes to existing functionality
- ✅ Affects all edge materials (A, B, C, D) consistently

## Testing

The fix has been tested with:
- Single panel with edge materials
- Multiple panels with different quantities
- Mixed edge material configurations
- Quote creation and editing workflows

## Related Files

- `src/lib/pricing/quoteCalculations.ts` - Main calculation logic
- `src/app/(dashboard)/opti/OptiClient.tsx` - UI display
- `src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx` - Quote summary display

## Future Considerations

- Monitor edge material pricing accuracy in production
- Consider adding unit tests for edge material calculations
- Document edge material pricing rules for future developers

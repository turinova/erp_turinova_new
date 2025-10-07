# Technical Decision Record: Quote Pricing System Fixes

## Status
Accepted

## Context
The quote pricing system had critical issues with material quantity displays and pricing calculations, particularly for:
1. Mixed pricing scenarios (panel area + full board pricing)
2. On-stock false materials board counting
3. Quote detail page display clarity

## Decision
Implement comprehensive fixes to ensure accurate pricing calculations and displays across all material pricing scenarios.

## Rationale

### 1. Mixed Pricing Logic Fix
**Problem**: Materials with both panel area and full board pricing were incorrectly calculating `charged_sqm` and `boards_used`.

**Decision**: Implement mutually exclusive calculation logic:
- `charged_sqm` = sum of panel area pricing only (panel area × waste multiplier)
- `boards_used` = count of full board pricing only

**Rationale**: This aligns with business requirements where panel area pricing and full board pricing are distinct pricing methods that should not be combined.

### 2. On-Stock False Materials Fix
**Problem**: Materials with `on_stock = false` were creating only one virtual board entry, causing incorrect board counting.

**Decision**: Create separate board entries for each board used instead of a single virtual entry.

**Rationale**: The OptiClient counts boards by iterating through the `boards` array. Creating separate entries ensures accurate counting.

### 3. Quote Detail Display Fix
**Problem**: The quote detail table was showing total gross prices (including services) instead of material-only prices.

**Decision**: Display only material gross prices in the main table, with services shown separately.

**Rationale**: This provides clearer separation between material costs and service costs, improving user understanding.

## Implementation Details

### Files Modified
1. `src/lib/pricing/quoteCalculations.ts`
2. `src/app/(dashboard)/opti/OptiClient.tsx`
3. `src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`

### Key Changes
1. **Waste Multiplier Integration**: Include waste multiplier directly in `charged_area_m2` calculation
2. **Board Entry Creation**: Create separate entries for each board used in on-stock false materials
3. **Filtered Calculations**: Filter board arrays by pricing method for accurate calculations
4. **Display Separation**: Show material costs separately from service costs

## Consequences

### Positive
- ✅ Accurate material quantity displays
- ✅ Correct pricing calculations for all scenarios
- ✅ Clear separation of material vs service costs
- ✅ Consistent business logic across the application

### Negative
- Legacy quotes may show incorrect values until re-saved
- Requires re-running optimization to take effect
- Database values are updated when quotes are saved/updated

## Alternatives Considered

### Alternative 1: Client-Side Display Fix Only
**Rejected**: This would not fix the underlying calculation issues and would create inconsistencies.

### Alternative 2: Database Migration
**Considered**: Could update all legacy quotes, but decided against due to complexity and risk.

### Alternative 3: Complex Legacy Detection Logic
**Rejected**: Would add unnecessary complexity and maintenance burden.

## Implementation Notes

### Testing Scenarios
1. **Mixed Pricing**: Panel area + full board pricing
2. **On-Stock False**: Materials not in stock
3. **Panel Area Only**: Materials with only panel area pricing
4. **Full Board Only**: Materials with only full board pricing

### Validation
- All pricing calculations now follow consistent business logic
- Display formats are standardized across the application
- Database schema remains unchanged (backward compatible)

## Review
This decision was made after extensive testing and user feedback. The implementation maintains backward compatibility while providing correct business logic for all pricing scenarios.

## Date
January 27, 2025

## Author
AI Assistant (Claude Sonnet 4)

## Reviewers
- User (ERP System Owner)
- Development Team

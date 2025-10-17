# Accessories Pricing System Modification

**Date:** January 28, 2025  
**Feature:** Base Price and Multiplier Pricing System for Accessories  
**Status:** ✅ Completed  

## Overview

Modified the accessories pricing system from a direct `net_price` approach to a more flexible `base_price` and `multiplier` system. This allows for better price management and easier adjustments while maintaining backward compatibility.

## Key Changes

### 1. Database Schema Updates

#### Accessories Table (`accessories`)
- **Added:** `base_price` (INTEGER) - Base price component
- **Added:** `multiplier` (DECIMAL(3,2)) - Multiplier component  
- **Modified:** `net_price` now calculated as `base_price × multiplier`
- **Default:** `multiplier = 1.38` for existing records
- **Constraints:** 
  - `base_price >= 0`
  - `multiplier BETWEEN 1.0 AND 5.0`

#### Quote Accessories Table (`quote_accessories`)
- **Added:** `base_price` (INTEGER) - Stores base price for quote-specific pricing
- **Added:** `multiplier` (DECIMAL(3,2)) - Stores multiplier for quote-specific pricing
- **Modified:** `unit_price_net` now calculated from stored `base_price × multiplier`

### 2. API Route Updates

#### `/api/accessories/[id]/route.ts`
- **GET:** Updated to include `base_price` and `multiplier` in select queries
- **PUT:** Modified to accept `base_price` and `multiplier` instead of `net_price`
- **Validation:** Added validation for new fields
- **Calculation:** Automatic `net_price` calculation from `base_price × multiplier`

#### `/api/quotes/[id]/accessories/route.ts`
- **GET:** Updated to include `base_price` and `multiplier` in select queries
- **POST:** Modified to store `base_price` and `multiplier` in quote accessories
- **Calculation:** Uses `base_price × multiplier` for net price calculation

### 3. Frontend Component Updates

#### AddAccessoryModal (`/quotes/[quote_id]/AddAccessoryModal.tsx`)
- **New Fields:** Added "Alapár (Ft)" and "Szorzó" input fields
- **Removed Fields:** Removed manual "Nettó ár" and "Bruttó ár" inputs
- **Auto-calculation:** Automatic calculation of net and gross prices
- **Layout:** Reorganized into 4-row structure:
  - Row 1: Termék neve | SKU
  - Row 2: Mennyiség | Alapár | Szorzó
  - Row 3: ÁFA | Pénznem | Mértékegység
  - Row 4: Partner
- **Validation:** Updated to validate `base_price > 0` and `multiplier` between 1.0-5.0

#### QuoteAccessoriesSection (`/quotes/[quote_id]/QuoteAccessoriesSection.tsx`)
- **Interface:** Updated to include `base_price` and `multiplier` fields
- **Display:** Removed "Alapár" and "Szorzó" columns from table (kept internal handling)
- **Calculation:** Uses stored values for pricing calculations

#### AccessoryFormClient (`/accessories/AccessoryFormClient.tsx`)
- **New Fields:** Added "Alapár (Ft)" and "Szorzó" input fields
- **Auto-calculation:** Automatic `net_price` calculation
- **Layout:** Reorganized into 3-row structure
- **Validation:** Added validation for new fields

#### AccessoriesListClient (`/accessories/AccessoriesListClient.tsx`)
- **Table Headers:** Added "Alapár" and "Szorzó" columns
- **Display:** Shows both `base_price` and `multiplier` with chip UI for multiplier
- **Import/Export:** Updated to handle new fields

### 4. Export/Import Updates

#### Export (`/api/accessories/export/route.ts`)
- **Columns:** Updated to export `base_price` and `multiplier` instead of `net_price`
- **Headers:** "Alapár (Ft)" and "Szorzó" columns

#### Import (`/api/accessories/import/route.ts`)
- **Parsing:** Updated to parse `base_price` and `multiplier` from Excel
- **Calculation:** Converts to `net_price` using `base_price × multiplier`
- **Validation:** Validates new fields

#### Import Preview (`/api/accessories/import/preview/route.ts`)
- **Validation:** Updated to check for new required fields
- **Preview:** Shows `base_price` and `multiplier` in preview table

### 5. Server-side Functions

#### `supabase-server.ts`
- **getAllAccessories():** Updated to include `base_price` and `multiplier`
- **getAccessoryById():** Updated to include `base_price` and `multiplier`

## Migration Scripts

### `modify_accessories_table_pricing.sql`
- Adds `base_price` and `multiplier` columns to `accessories` table
- Updates existing records with calculated values
- Creates trigger for automatic `net_price` calculation
- Adds constraints for data validation

### `add_base_price_multiplier_to_quote_accessories.sql`
- Adds `base_price` and `multiplier` columns to `quote_accessories` table
- Updates existing records with calculated values
- Adds constraints for data validation

## Benefits

### 1. **Flexible Pricing**
- Easy to adjust prices by changing multiplier
- Base price remains stable while multiplier can vary
- Better price management for different scenarios

### 2. **Quote-Specific Pricing**
- Each quote can have different `base_price` and `multiplier` values
- Allows for custom pricing per quote without affecting global prices
- Maintains historical pricing accuracy

### 3. **Improved UX**
- Cleaner modal layout with logical field grouping
- Automatic calculations reduce manual input errors
- Price preview shows all components clearly

### 4. **Data Integrity**
- Automatic `net_price` calculation ensures consistency
- Constraints prevent invalid values
- Backward compatibility maintained

## Technical Details

### Calculation Formula
```
net_price = Math.round(base_price × multiplier)
gross_price = Math.round(net_price × (1 + vat_rate))
```

### Validation Rules
- `base_price`: Must be ≥ 0 (integer)
- `multiplier`: Must be between 1.0 and 5.0 (decimal with 2 places)
- `net_price`: Automatically calculated (integer)

### Default Values
- `base_price`: 0 (for new accessories)
- `multiplier`: 1.38 (fallback for existing records)

## Testing

### Test Cases
1. **Create new accessory** with base_price=5000, multiplier=2, VAT=27%
   - Expected: net_price=10000, gross_price=12700
2. **Modify existing accessory** pricing in quote
   - Expected: Changes apply to quote only, not global accessory
3. **Export/Import** with new pricing system
   - Expected: All fields correctly exported and imported
4. **Validation** of field constraints
   - Expected: Proper error messages for invalid values

## Files Modified

### Database
- `modify_accessories_table_pricing.sql`
- `add_base_price_multiplier_to_quote_accessories.sql`

### API Routes
- `src/app/api/accessories/[id]/route.ts`
- `src/app/api/quotes/[id]/accessories/route.ts`
- `src/app/api/accessories/export/route.ts`
- `src/app/api/accessories/import/route.ts`
- `src/app/api/accessories/import/preview/route.ts`

### Frontend Components
- `src/app/(dashboard)/quotes/[quote_id]/AddAccessoryModal.tsx`
- `src/app/(dashboard)/quotes/[quote_id]/QuoteAccessoriesSection.tsx`
- `src/app/(dashboard)/accessories/AccessoryFormClient.tsx`
- `src/app/(dashboard)/accessories/AccessoriesListClient.tsx`

### Server Functions
- `src/lib/supabase-server.ts`

## Future Considerations

1. **Price History**: Consider tracking changes to `base_price` and `multiplier`
2. **Bulk Updates**: Add functionality to update multiple accessories at once
3. **Price Templates**: Create predefined multiplier templates for different scenarios
4. **Analytics**: Track usage patterns of different multiplier values

## Conclusion

The new pricing system provides greater flexibility and better user experience while maintaining data integrity and backward compatibility. The implementation follows best practices with proper validation, automatic calculations, and clean UI design.

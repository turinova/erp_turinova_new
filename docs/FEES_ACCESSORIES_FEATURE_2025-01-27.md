# Fees and Accessories Feature Implementation

**Date:** January 27, 2025  
**Feature:** Add fees and accessories to quotes with automatic total calculation  
**Status:** Backend Complete - Frontend Pending  

## Overview

This feature allows users to add multiple fees (like shipping, SOS) and accessories (like screws, handles) to quotes. The fees and accessories are displayed in separate cards on the quote detail page, with their totals shown in the main summary. Discounts only apply to materials, not to fees or accessories.

## Database Schema

### `quote_fees` Table
Stores fees added to quotes (always quantity = 1).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| quote_id | UUID | FK to quotes |
| feetype_id | UUID | FK to feetypes |
| fee_name | VARCHAR(255) | Snapshot of fee name |
| unit_price_net | DECIMAL(12,2) | Net price |
| vat_rate | DECIMAL(5,4) | VAT rate (0.27 = 27%) |
| vat_amount | DECIMAL(12,2) | Calculated VAT |
| gross_price | DECIMAL(12,2) | Calculated gross |
| currency_id | UUID | FK to currencies |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |
| deleted_at | TIMESTAMP | Soft delete |

### `quote_accessories` Table
Stores accessories added to quotes (quantity can be > 1).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| quote_id | UUID | FK to quotes |
| accessory_id | UUID | FK to accessories |
| quantity | INTEGER | Number of units |
| accessory_name | VARCHAR(255) | Snapshot of name |
| sku | VARCHAR(255) | Snapshot of SKU |
| unit_price_net | DECIMAL(12,2) | Net price per unit |
| vat_rate | DECIMAL(5,4) | VAT rate |
| unit_id | UUID | FK to units |
| unit_name | VARCHAR(100) | Snapshot of unit |
| currency_id | UUID | FK to currencies |
| total_net | DECIMAL(12,2) | Calculated: unit_price × quantity |
| total_vat | DECIMAL(12,2) | Calculated VAT |
| total_gross | DECIMAL(12,2) | Calculated gross |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |
| deleted_at | TIMESTAMP | Soft delete |

### `quotes` Table Updates
Added columns for totals:

| Column | Type | Description |
|--------|------|-------------|
| fees_total_net | DECIMAL(12,2) | Sum of all fees net |
| fees_total_vat | DECIMAL(12,2) | Sum of all fees VAT |
| fees_total_gross | DECIMAL(12,2) | Sum of all fees gross |
| accessories_total_net | DECIMAL(12,2) | Sum of all accessories net |
| accessories_total_vat | DECIMAL(12,2) | Sum of all accessories VAT |
| accessories_total_gross | DECIMAL(12,2) | Sum of all accessories gross |

## API Endpoints

### Fees
- `GET /api/quotes/[id]/fees` - Get all fees for a quote
- `POST /api/quotes/[id]/fees` - Add a fee to a quote
  - Body: `{ feetype_id: string }`
- `DELETE /api/quotes/[id]/fees/[feeId]` - Remove a fee

### Accessories
- `GET /api/quotes/[id]/accessories` - Get all accessories for a quote
- `POST /api/quotes/[id]/accessories` - Add an accessory to a quote
  - Body: `{ accessory_id: string, quantity: number }`
- `PATCH /api/quotes/[id]/accessories/[accessoryId]` - Update accessory quantity
  - Body: `{ quantity: number }`
- `DELETE /api/quotes/[id]/accessories/[accessoryId]` - Remove an accessory

## Calculation Logic

### Total Calculation
```typescript
// 1. Materials with discount
const materialsNet = quote.total_net;
const materialsVat = quote.total_vat;
const materialsGross = quote.total_gross;
const discountMultiplier = 1 - (quote.discount_percent / 100);
const materialsAfterDiscount = materialsGross * discountMultiplier;

// 2. Fees (no discount applied)
const feesTotal = quote.fees_total_gross;

// 3. Accessories (no discount applied)
const accessoriesTotal = quote.accessories_total_gross;

// 4. Grand total
const finalTotal = materialsAfterDiscount + feesTotal + accessoriesTotal;
```

### Auto-Recalculation
When a fee or accessory is added/updated/removed, the system automatically:
1. Recalculates fees totals
2. Recalculates accessories totals
3. Updates the quote's total fields
4. Recalculates final_total_after_discount

## UI Layout

### Quote Detail Page Structure
```
┌───────────────────────────────────────────┐
│  Árajánlat összesítése                    │
│  ─────────────────────────────────────    │
│  Anyagok összesen:    1,234,567 Ft        │
│  Kedvezmény (10%):     -123,456 Ft        │
│  Anyagok kedvezménnyel: 1,111,111 Ft      │
│  ─────────────────────────────────────    │
│  Díjak összesen:         10,000 Ft        │
│  Termékek összesen:      25,000 Ft        │
│  ─────────────────────────────────────    │
│  Végösszeg (Nettó):    1,146,111 Ft       │
│  ÁFA (27%):              309,450 Ft       │
│  Végösszeg (Bruttó):   1,455,561 Ft       │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│  Díjak          [+ Díj hozzáadása]        │
│  ─────────────────────────────────────    │
│  [Table with bulk select/delete]          │
│  ☐ Szállítás | 1,000 Ft | 270 Ft | 1,270 │
│  ☐ SOS       | 2,500 Ft | 675 Ft | 3,175 │
│  Összesen:  3,500 Ft  945 Ft  4,445 Ft   │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│  Termékek      [+ Termék hozzáadása]      │
│  ─────────────────────────────────────    │
│  [Table with bulk select/delete]          │
│  ☐ Csavar | 10 db | 50 Ft | 500 | 135 |  │
│  ☐ Fogantyú | 5 db | 200 | 1000 | 270 |  │
│  Összesen:  1,500 Ft  405 Ft  1,905 Ft   │
└───────────────────────────────────────────┘
```

## Features

### Fees Section
- ✅ Add fee via modal (select from feetypes)
- ✅ Always quantity = 1
- ✅ Bulk select and bulk delete
- ✅ Individual delete
- ✅ Shows net, VAT, and gross
- ✅ Totals at bottom

### Accessories Section
- ✅ Add accessory via modal (select from accessories)
- ✅ Specify quantity (can be > 1)
- ✅ Edit quantity inline
- ✅ Bulk select and bulk delete
- ✅ Individual delete
- ✅ Shows unit, unit price, totals
- ✅ Totals at bottom

### Summary Section
- ✅ Shows materials with discount
- ✅ Shows fees total (no discount)
- ✅ Shows accessories total (no discount)
- ✅ Calculates final grand total

## Implementation Status

### ✅ Completed
1. **Database Schema**
   - Created `quote_fees` table with indexes and RLS
   - Created `quote_accessories` table with indexes and RLS
   - Added totals columns to `quotes` table

2. **Backend API**
   - Fees CRUD endpoints
   - Accessories CRUD endpoints
   - Auto-recalculation logic
   - Snapshot pricing for historical accuracy

3. **Server-Side Rendering**
   - Updated `getQuoteById()` to fetch fees and accessories
   - Includes totals in response
   - Performance logging

### 🚧 Pending
1. **Frontend Components**
   - QuoteFeesSection component
   - QuoteAccessoriesSection component
   - AddFeeModal component
   - AddAccessoryModal component
   - Update QuoteDetailClient

2. **Testing**
   - Manual testing of all CRUD operations
   - Bulk operations testing
   - Total calculations verification

## SQL Files Created

1. `create_quote_fees_table.sql` - Creates quote_fees table
2. `create_quote_accessories_table.sql` - Creates quote_accessories table
3. `alter_quotes_table_for_fees_accessories.sql` - Adds columns to quotes table

**⚠️ IMPORTANT:** These SQL files must be run manually by the user in Supabase SQL Editor.

## Files Modified

1. `src/lib/supabase-server.ts`
   - Updated `getQuoteById()` to fetch fees and accessories
   - Added totals to response

2. API Routes Created:
   - `src/app/api/quotes/[id]/fees/route.ts`
   - `src/app/api/quotes/[id]/fees/[feeId]/route.ts`
   - `src/app/api/quotes/[id]/accessories/route.ts`
   - `src/app/api/quotes/[id]/accessories/[accessoryId]/route.ts`

## Business Rules

1. **Fees:**
   - Always quantity = 1
   - No discount applied
   - Can be added/removed at any time
   - Prices are snapshots at time of adding

2. **Accessories:**
   - Quantity can be any positive integer
   - No discount applied
   - Can be added/removed/quantity updated at any time
   - Prices are snapshots at time of adding

3. **Discounts:**
   - Only apply to materials (not fees or accessories)
   - Discount percentage from customer or quote level

4. **Totals:**
   - Auto-calculate on any change
   - Fees and accessories totals stored separately
   - Final total = (materials_with_discount) + fees + accessories

## Security

- RLS policies enabled on both tables
- Authenticated users only
- Soft delete (deleted_at column)
- Foreign key constraints
- Check constraints (quantity > 0)

## Performance

- Indexed on quote_id for fast queries
- Indexed on deleted_at for soft delete queries
- Bulk operations supported for efficiency
- SSR fetches all data in parallel

## Next Steps

1. User must manually run SQL scripts
2. Implement frontend components
3. Add user interface for fees and accessories
4. Test complete workflow
5. Document user guide
6. Commit to git after testing

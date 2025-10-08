# Fee Quantity and Comment Update

**Date:** January 27, 2025  
**Feature:** Enhanced fee management with quantity, editable price, and comments  
**Status:** Complete - Ready for SQL execution  

---

## Changes Overview

Enhanced the fees system to support:
1. ✅ **Variable quantity** - Fees can have quantity > 1
2. ✅ **Editable unit price** - User can modify price when adding to quote
3. ✅ **Negative values** - Support for discounts/adjustments
4. ✅ **Comments** - Optional per-quote notes for each fee

---

## Database Changes

### 1. `quote_fees` Table
Added two new columns:

```sql
ALTER TABLE quote_fees 
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN comment TEXT NULL;
```

### 2. `feetypes` Table
No schema changes needed - DECIMAL already supports negative values.
Updated documentation to clarify negative values are allowed.

---

## Calculation Changes

### Old Logic (Quantity Always = 1)
```typescript
totalGross = unit_price_net + vat_amount
```

### New Logic (Quantity Variable)
```typescript
totalNet = unit_price_net × quantity
totalVat = totalNet × vat_rate
totalGross = totalNet + totalVat
```

### Example Calculations

**Example 1: Shipping × 10**
- Fee type: "Szállítás"
- Unit price: 1,000 Ft
- Quantity: 10
- VAT: 27%
- Total net: 1,000 × 10 = 10,000 Ft
- Total VAT: 10,000 × 0.27 = 2,700 Ft
- **Total gross: 12,700 Ft**

**Example 2: Discount (Negative)**
- Fee type: "Kedvezmény"
- Unit price: -5,000 Ft
- Quantity: 1
- VAT: 27%
- Total net: -5,000 × 1 = -5,000 Ft
- Total VAT: -5,000 × 0.27 = -1,350 Ft
- **Total gross: -6,350 Ft** (reduces final total)

**Example 3: Adjustment with Comment**
- Fee type: "Korrekció"
- Unit price: 2,500 Ft (modified from default)
- Quantity: 3
- Comment: "3. emeleti szállítás"
- VAT: 27%
- Total net: 2,500 × 3 = 7,500 Ft
- Total VAT: 7,500 × 0.27 = 2,025 Ft
- **Total gross: 9,525 Ft**

---

## UI Changes

### Díjak Table (Updated Columns)

**Old:**
```
| ☐ | Díj neve | Nettó ár | ÁFA | Bruttó ár |
```

**New:**
```
| ☐ | Díj neve | Mennyiség | Egységár | Összeg | Megjegyzés |
```

### Add Fee Modal (Enhanced)

**Old:**
```
┌────────────────────────────┐
│ Díjtípus: [Select ▼]      │
│ [Preview]                  │
│ [Mégse] [Hozzáadás]        │
└────────────────────────────┘
```

**New:**
```
┌─────────────────────────────────────┐
│ Díjtípus *: [Select ▼]             │
│ Mennyiség *: [___1___]              │
│ Egységár (Nettó) *: [_______]       │
│   ↑ Módosítható érték               │
│ Megjegyzés: [________________]      │
│   (Opcionális)                      │
│                                      │
│ ┌─────────────────────────────┐     │
│ │ Ár előnézet:                │     │
│ │ Egységár:      1,000 Ft     │     │
│ │ Mennyiség:          10      │     │
│ │ ─────────────────────────   │     │
│ │ Nettó összesen: 10,000 Ft   │     │
│ │ ÁFA (27%):       2,700 Ft   │     │
│ │ ─────────────────────────   │     │
│ │ Bruttó összesen: 12,700 Ft  │     │
│ └─────────────────────────────┘     │
│                                      │
│ [Mégse] [Hozzáadás]                 │
└─────────────────────────────────────┘
```

---

## API Changes

### POST /api/quotes/[quote_id]/fees

**Old Request:**
```json
{
  "feetype_id": "uuid"
}
```

**New Request:**
```json
{
  "feetype_id": "uuid",
  "quantity": 10,
  "unit_price_net": 1000,
  "comment": "Valami megjegyzés"
}
```

**Parameters:**
- `feetype_id` (required) - UUID of fee type
- `quantity` (optional, default: 1) - Number of units
- `unit_price_net` (optional) - Custom unit price (overrides fee type default)
- `comment` (optional) - Per-quote note

**Response includes new fields:**
```json
{
  "id": "uuid",
  "fee_name": "Szállítás",
  "quantity": 10,
  "unit_price_net": 1000,
  "vat_amount": 2700,
  "gross_price": 12700,
  "comment": "Valami megjegyzés",
  ...
}
```

---

## Use Cases

### Use Case 1: Standard Fee
- User adds "Szállítás" fee
- Default: quantity=1, price=1,000 Ft
- No modifications needed
- Result: 1,270 Ft added to quote

### Use Case 2: Multiple Units
- User adds "Szállítás" fee
- Sets quantity to 10
- Keeps default price 1,000 Ft
- Comment: "10 különböző címre"
- Result: 12,700 Ft added to quote

### Use Case 3: Custom Price
- User adds "SOS" fee
- Quantity: 1
- Changes price from 2,500 Ft to 3,000 Ft
- Comment: "Sürgős szállítás este 8 után"
- Result: 3,810 Ft added to quote

### Use Case 4: Discount (Negative)
- User adds "Kedvezmény" fee
- Unit price: -5,000 Ft (negative)
- Quantity: 1
- Comment: "Törzsvásárlói kedvezmény"
- Result: -6,350 Ft (reduces final total)

### Use Case 5: Adjustment
- User adds "Korrekció" fee
- Unit price: -1,000 Ft
- Quantity: 2
- Comment: "Hibás számítás korrekciója"
- Result: -2,540 Ft (reduces final total)

---

## Migration Steps

### Step 1: Run SQL (Manual)
User must run: `alter_quote_fees_table_add_quantity_comment.sql`

```sql
ALTER TABLE public.quote_fees 
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
ADD COLUMN IF NOT EXISTS comment TEXT NULL;
```

### Step 2: Verify Tables
```sql
-- Check columns added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quote_fees' 
AND column_name IN ('quantity', 'comment');

-- Should return:
-- quantity  | integer | NO
-- comment   | text    | YES
```

### Step 3: Test Backend
- API endpoints updated ✅
- Auto-calculation updated ✅
- SSR updated ✅

### Step 4: Test Frontend
- Modal updated ✅
- Table updated ✅
- Calculations updated ✅

---

## Breaking Changes

### None - Backward Compatible

- Existing fees without `quantity` column will default to 1
- Existing fees without `comment` column will be NULL
- All calculations still work correctly
- No data migration needed

---

## Technical Implementation

### Files Modified

1. ✅ `alter_quote_fees_table_add_quantity_comment.sql` - Database schema
2. ✅ `alter_feetypes_allow_negative.sql` - Documentation
3. ✅ `src/app/api/quotes/[id]/fees/route.ts` - API logic
4. ✅ `src/lib/supabase-server.ts` - SSR fetching
5. ✅ `src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx` - Interface
6. ✅ `src/app/(dashboard)/quotes/[quote_id]/QuoteFeesSection.tsx` - Display
7. ✅ `src/app/(dashboard)/quotes/[quote_id]/AddFeeModal.tsx` - Input

### Code Changes Summary

**API (route.ts):**
- Accepts `quantity`, `unit_price_net`, `comment` parameters
- Calculates `totalNet = unit_price × quantity`
- Calculates `totalVat = totalNet × vat_rate`
- Stores all values in `quote_fees`
- Recalculation updated to use quantity

**SSR (supabase-server.ts):**
- Fetches `quantity` and `comment` fields
- Passes to client component

**Display (QuoteFeesSection.tsx):**
- Updated table columns
- Updated total calculations to use quantity
- Shows comment or '-' if empty

**Input (AddFeeModal.tsx):**
- Added quantity input
- Added editable unit price input
- Added comment textarea
- Real-time preview with quantity calculation
- Auto-fills unit price on fee type selection

---

## Testing Checklist

### Basic Functionality
- [ ] Run SQL to add columns
- [ ] Add fee with default values (quantity=1, default price)
- [ ] Verify appears in table correctly
- [ ] Verify totals calculated correctly

### Quantity Feature
- [ ] Add fee with quantity=10
- [ ] Verify "Mennyiség" column shows 10
- [ ] Verify "Összeg" = Egységár × 10
- [ ] Verify totals include full amount

### Editable Price
- [ ] Select fee type (e.g., "Szállítás" 1,000 Ft)
- [ ] Change unit price to 1,500 Ft
- [ ] Verify preview updates
- [ ] Add to quote
- [ ] Verify stored price is 1,500 Ft (not 1,000 Ft)

### Comment Feature
- [ ] Add fee with comment "Test comment"
- [ ] Verify comment appears in "Megjegyzés" column
- [ ] Add fee without comment
- [ ] Verify shows '-' in table

### Negative Values
- [ ] Create fee type with negative price (e.g., "Kedvezmény" -5,000 Ft)
- [ ] Add to quote
- [ ] Verify negative amount shown correctly
- [ ] Verify reduces final total

### Bulk Operations
- [ ] Add multiple fees
- [ ] Select all with checkbox
- [ ] Bulk delete
- [ ] Verify totals recalculated

---

## SQL Files to Run

**IMPORTANT:** User must manually run these SQL files in order:

1. ✅ `alter_quote_fees_table_add_quantity_comment.sql` - Adds columns
2. ✅ `alter_feetypes_allow_negative.sql` - Documentation only

---

## Ready for Testing

After running the SQL scripts, the enhanced fees system will be ready with:
- ✅ Variable quantity support
- ✅ Editable unit prices
- ✅ Negative value support
- ✅ Optional comments
- ✅ Updated UI
- ✅ Correct calculations

**Not committed to git yet** - awaiting user testing and SQL execution.

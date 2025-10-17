# Discount System Update - Apply to All Categories

**Date:** January 27, 2025  
**Feature:** Universal discount application to materials, fees, and accessories  
**Status:** Complete  

---

## Changes Overview

Updated the discount system to:
1. ✅ **Apply discount to all categories** - Materials, Fees, AND Accessories
2. ✅ **Exclude negative values** - Negative fees/accessories don't get discount
3. ✅ **Editable discount percentage** - Via "Kedvezmény" button in right column
4. ✅ **Simple math display** - Clear breakdown in summary

---

## Business Logic

### Old Logic (Discount Only on Materials)
```
Materials:      100,000 Ft
Discount (10%): -10,000 Ft
Materials Final: 90,000 Ft

Fees:            10,000 Ft (no discount)
Accessories:      5,000 Ft (no discount)

Final Total:    105,000 Ft
```

### New Logic (Discount on All Positive Values)
```
Materials:      100,000 Ft
Fees:            10,000 Ft
Accessories:      5,000 Ft
────────────────────────────
Részösszeg:     115,000 Ft (only positive values)
Discount (10%): -11,500 Ft (applied to subtotal)
────────────────────────────
Végösszeg:      103,500 Ft
```

### With Negative Values
```
Materials:      100,000 Ft
Fees:            10,000 Ft
Accessories:     -5,000 Ft (negative, excluded from discount)
────────────────────────────
Részösszeg:     110,000 Ft (only positive: 100k + 10k)
Discount (10%): -11,000 Ft (on 110,000 Ft only)
Negative items:  -5,000 Ft (added after discount)
────────────────────────────
Végösszeg:       94,000 Ft
```

### Formula

```typescript
// Step 1: Separate positive and negative values
materialsGross = quote.total_gross
feesPositive = Math.max(0, fees_total_gross)
accessoriesPositive = Math.max(0, accessories_total_gross)
feesNegative = Math.min(0, fees_total_gross)
accessoriesNegative = Math.min(0, accessories_total_gross)

// Step 2: Calculate subtotal (only positive values)
subtotal = materialsGross + feesPositive + accessoriesPositive

// Step 3: Calculate discount (on subtotal only)
discountAmount = subtotal × (discount_percent / 100)

// Step 4: Add negative values (no discount on these)
finalTotal = subtotal - discountAmount + feesNegative + accessoriesNegative
```

---

## UI Changes

### Summary Display (New)

```
┌─────────────────────────────┐
│ Anyagok:        100,000 Ft  │
│ Díjak:           10,000 Ft  │
│ Termékek:         5,000 Ft  │
│ ───────────────────────────│
│ Részösszeg:     115,000 Ft  │
│ Kedvezmény (10%): -11,500 Ft│
│ ───────────────────────────│
│ Végösszeg:      103,500 Ft  │
└─────────────────────────────┘
```

### Right Column - New Button

```
┌──────────────────────────┐
│ Műveletek                │
│ ────────────────────────│
│ [Opti szerkesztés]       │
│ [Kedvezmény (10%)]  ← NEW│
│ ────────────────────────│
│ [Export Excel]           │
│ [Nyomtatás]              │
│ [Fizetés hozzáadás]      │
│ [Megrendelés]            │
└──────────────────────────┘
```

### Discount Edit Modal

```
┌────────────────────────────────┐
│ Kedvezmény szerkesztése        │
│ ──────────────────────────────│
│                                 │
│ Kedvezmény százalék:            │
│ [____10____] %                  │
│ 0 és 100% között                │
│                                 │
│ ℹ️ A kedvezmény az anyagokra,   │
│   díjakra és termékekre is      │
│   vonatkozik. Negatív értékű    │
│   díjak és termékek nem kapnak  │
│   kedvezményt.                  │
│                                 │
│ [Mégse] [Mentés]                │
└────────────────────────────────┘
```

---

## API Changes

### New Endpoint: PATCH /api/quotes/[id]

**Request:**
```json
{
  "discount_percent": 15
}
```

**Response:**
```json
{
  "success": true,
  "discount_percent": 15
}
```

**Side Effects:**
- Updates `quotes.discount_percent`
- Calls `recalculateQuoteTotals()`
- Recalculates `final_total_after_discount` with new logic

---

## Calculation Examples

### Example 1: Standard Discount
```
Materials:      100,000 Ft
Fees:            10,000 Ft (Szállítás × 10)
Accessories:      5,000 Ft (Csavar × 100)
Discount:            10%

Subtotal:       115,000 Ft (100k + 10k + 5k)
Discount:       -11,500 Ft (115k × 10%)
Final Total:    103,500 Ft
```

### Example 2: With Negative Fee (Discount/Adjustment)
```
Materials:      100,000 Ft
Fees:            10,000 Ft (Szállítás)
Fees:            -5,000 Ft (Kedvezmény - negative)
Accessories:      5,000 Ft (Csavar)
Discount:            10%

Positive values: 115,000 Ft (100k + 10k + 5k)
Subtotal:        115,000 Ft
Discount:        -11,500 Ft (on 115k only)
Negative items:   -5,000 Ft (no discount on this)
────────────────────────────
Final Total:      98,500 Ft
```

### Example 3: Result Can Be Negative
```
Materials:        10,000 Ft
Fees:            -50,000 Ft (Large adjustment)
Accessories:       1,000 Ft
Discount:             10%

Positive values:  11,000 Ft (10k + 1k)
Subtotal:         11,000 Ft
Discount:         -1,100 Ft (on 11k only)
Negative items:  -50,000 Ft (no discount)
────────────────────────────
Final Total:     -40,100 Ft (NEGATIVE - ALLOWED)
```

---

## Implementation Details

### Files Modified

1. **`src/app/api/quotes/[id]/route.ts`**
   - Added PATCH endpoint for discount update
   - Imports `recalculateQuoteTotals`

2. **`src/app/api/quotes/[id]/fees/route.ts`**
   - Updated `recalculateQuoteTotals()` with new logic
   - Separates positive and negative values
   - Applies discount only to positive values

3. **`src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`**
   - Updated summary display to show simple math
   - Added "Kedvezmény" button to right column
   - Added discount modal state and handlers
   - Integrated EditDiscountModal

4. **`src/app/(dashboard)/quotes/[quote_id]/EditDiscountModal.tsx`** (NEW)
   - Simple modal with percentage input
   - Validation (0-100%)
   - Helper text explaining discount logic

---

## User Workflow

### Edit Discount Percentage

1. User opens quote detail page
2. Right column shows "Kedvezmény (10%)" button
3. User clicks button
4. Modal opens with current discount (10%)
5. User changes to 15%
6. Clicks "Mentés"
7. ✅ Quote discount updated
8. ✅ Totals recalculated
9. ✅ Summary updates to show new discount
10. ✅ Button updates to "Kedvezmény (15%)"
11. ✅ Success toast appears

---

## Edge Cases Handled

### 1. No Discount (0%)
```
Anyagok:        100,000 Ft
Díjak:           10,000 Ft
Termékek:         5,000 Ft
────────────────────────────
Részösszeg:     115,000 Ft
(No discount line shown)
────────────────────────────
Végösszeg:      115,000 Ft
```

### 2. All Negative Values
```
Anyagok:              0 Ft
Díjak:          -10,000 Ft
Termékek:        -5,000 Ft
────────────────────────────
Részösszeg:           0 Ft
Discount (10%):       0 Ft (no positive values)
Negative items: -15,000 Ft
────────────────────────────
Végösszeg:      -15,000 Ft
```

### 3. Mixed Positive and Negative
```
Materials:      100,000 Ft
Fees:            10,000 Ft
Fees:           -20,000 Ft (negative)
Accessories:      5,000 Ft
Accessories:     -3,000 Ft (negative)
Discount:            10%

Positive:       115,000 Ft (100k + 10k + 5k)
Discount:       -11,500 Ft
Negative:       -23,000 Ft (-20k + -3k)
────────────────────────────
Final:           80,500 Ft
```

---

## Testing Checklist

### Basic Discount
- [ ] Set discount to 10%
- [ ] Add materials (100,000 Ft)
- [ ] Add fees (10,000 Ft)
- [ ] Add accessories (5,000 Ft)
- [ ] Verify subtotal: 115,000 Ft
- [ ] Verify discount: -11,500 Ft
- [ ] Verify final: 103,500 Ft

### Edit Discount
- [ ] Click "Kedvezmény (10%)" button
- [ ] Modal opens with current 10%
- [ ] Change to 15%
- [ ] Save
- [ ] Verify button updates to "Kedvezmény (15%)"
- [ ] Verify discount recalculated: -17,250 Ft
- [ ] Verify final: 97,750 Ft

### Negative Values
- [ ] Add negative fee (-5,000 Ft)
- [ ] Verify NOT included in subtotal
- [ ] Verify discount NOT applied to negative
- [ ] Verify negative added after discount
- [ ] Verify final total correct

### Zero Discount
- [ ] Set discount to 0%
- [ ] Verify no discount line shown
- [ ] Verify final = subtotal

### High Discount
- [ ] Set discount to 100%
- [ ] Verify subtotal × 100% = full discount
- [ ] Verify final = 0 (if no negatives)

---

## Security

- ✅ Discount must be 0-100%
- ✅ Validation on client and server
- ✅ Only authenticated users can edit
- ✅ Recalculation happens server-side
- ✅ No client-side price manipulation

---

## Summary

**Before:**
- Discount only on materials
- Fees and accessories at full price
- Complex calculation

**After:**
- Discount on all positive values
- Simple, clear calculation
- Editable via UI
- Negative values excluded (logical)
- Clean summary display

**Result:** More flexible and intuitive discount system!

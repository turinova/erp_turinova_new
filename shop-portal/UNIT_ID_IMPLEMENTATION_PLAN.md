# Unit ID Implementation Plan

## Problem Analysis

### Current Flow

**PULL (ShopRenter → ERP):**
1. `syncProductToDatabase` receives `desc.measurementUnit` (text like "db", "cm")
2. Calls `ensureUnitExists` which creates/finds unit and returns `unit_id`
3. Saves `measurement_unit` (text) to `shoprenter_product_descriptions.measurement_unit`
4. **Does NOT save `unit_id` to `shoprenter_products`** (column doesn't exist)

**PUSH (ERP → ShopRenter):**
1. Reads `huDescription.measurement_unit` (text) from `shoprenter_product_descriptions`
2. Sends to ShopRenter as `measurementUnit` in productDescriptions payload

**Product Edit Form:**
1. Saves `formData.measurement_unit` (shortform text) to `shoprenter_product_descriptions.measurement_unit`
2. **Does NOT save to `shoprenter_products`** (no unit_id column)

**Purchase Order API:**
1. Reads `measurement_unit` (text) from `shoprenter_product_descriptions`
2. Tries to match text to `units.shortform` to get `unit_id`
3. **Fragile**: String matching can fail, dimension units (cm) can be matched incorrectly

## Solution: Add `unit_id` to `shoprenter_products`

### Architecture

```
┌─────────────────────┐
│ shoprenter_products │
│  - unit_id (FK)     │ ← Source of truth (UUID)
└─────────────────────┘
         │
         │ JOIN
         ▼
┌─────────────────────┐
│ units               │
│  - id (UUID)        │
│  - shortform (text)  │
└─────────────────────┘
         │
         │ Used for ShopRenter sync
         ▼
┌──────────────────────────────┐
│ shoprenter_product_descriptions│
│  - measurement_unit (text)    │ ← For ShopRenter API (derived from unit_id)
└──────────────────────────────┘
```

### Implementation Steps

#### Phase 1: Database Migration
- Add `unit_id UUID REFERENCES units(id)` to `shoprenter_products`
- Create index for performance
- Backfill existing data from `measurement_unit` text

#### Phase 2: Update PULL Logic
- When syncing from ShopRenter:
  - Get `unit_id` from `ensureUnitExists`
  - Save `unit_id` to `shoprenter_products.unit_id`
  - Keep saving `measurement_unit` (text) to descriptions for backward compatibility

#### Phase 3: Update Product Edit Form
- Change dropdown to store `unit_id` (UUID) instead of `shortform` (text)
- Save `unit_id` to `shoprenter_products.unit_id`
- Also save `shortform` to `shoprenter_product_descriptions.measurement_unit` (derived from unit_id)

#### Phase 4: Update PUSH Logic
- When syncing to ShopRenter:
  - Read `unit_id` from `shoprenter_products`
  - Join with `units` table to get `shortform`
  - Use `shortform` for ShopRenter API `measurementUnit` field
  - Fallback to `measurement_unit` from descriptions if `unit_id` is NULL (backward compatibility)

#### Phase 5: Update Purchase Order API
- Use `product.unit_id` directly (no string matching)
- Join with `units` table to get `shortform` for display

#### Phase 6: Update Tenant Template
- Add `unit_id` column definition to `tenant-database-template.sql`

## Benefits

1. **Single Source of Truth**: `unit_id` in products table
2. **Type Safety**: UUID foreign key vs text matching
3. **Performance**: Indexed joins instead of text lookups
4. **Data Integrity**: FK constraints prevent invalid units
5. **Maintainability**: Unit changes handled via FK
6. **Backward Compatible**: Falls back to text if `unit_id` is NULL

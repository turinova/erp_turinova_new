# Fees and Accessories Management - Complete Guide

**Date:** January 27, 2025  
**Version:** 2.0  
**Status:** Production Ready  
**Feature:** Add fees and accessories to quotes with automatic total calculation  

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Business Logic](#business-logic)
4. [User Interface](#user-interface)
5. [API Endpoints](#api-endpoints)
6. [Implementation Details](#implementation-details)
7. [User Guide](#user-guide)
8. [Technical Specifications](#technical-specifications)
9. [Performance Optimization](#performance-optimization)
10. [Testing Guide](#testing-guide)

---

## Overview

This feature allows users to add multiple fees (like shipping, SOS fees) and accessories (like screws, handles, hardware) to quotes. The system automatically calculates totals and ensures that discounts only apply to materials, not to fees or accessories.

### Key Features

- ✅ **Add Fees to Quotes** - Select from predefined fee types
- ✅ **Add Accessories to Quotes** - Select existing or create new accessories on-the-fly
- ✅ **Bulk Operations** - Select multiple items and delete them at once
- ✅ **Automatic Calculations** - Totals update automatically
- ✅ **Discount Logic** - Discounts only apply to materials
- ✅ **Global Updates** - Modify accessory details globally from quote page
- ✅ **Snapshot Pricing** - Historical accuracy for quotes
- ✅ **Server-Side Rendering** - Fast page loads and instant modals

---

## Database Schema

### `quote_fees` Table

Stores fees added to quotes. Each fee always has quantity = 1.

```sql
CREATE TABLE quote_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  feetype_id UUID NOT NULL REFERENCES feetypes(id) ON DELETE RESTRICT,
  fee_name VARCHAR(255) NOT NULL,           -- Snapshot
  unit_price_net DECIMAL(12,2) NOT NULL,    -- Snapshot
  vat_rate DECIMAL(5,4) NOT NULL,           -- Snapshot
  vat_amount DECIMAL(12,2) NOT NULL,        -- Calculated
  gross_price DECIMAL(12,2) NOT NULL,       -- Calculated
  currency_id UUID NOT NULL REFERENCES currencies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL  -- Soft delete
);
```

**Indexes:**
- `idx_quote_fees_quote_id` - Fast lookups by quote
- `idx_quote_fees_deleted_at` - Efficient soft delete queries
- `idx_quote_fees_feetype_id` - Reference integrity

**Constraints:**
- Foreign key to `quotes` with CASCADE delete
- Foreign key to `feetypes` with RESTRICT delete
- RLS policies for authenticated users only

### `quote_accessories` Table

Stores accessories added to quotes with variable quantities.

```sql
CREATE TABLE quote_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  accessory_id UUID NOT NULL REFERENCES accessories(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  accessory_name VARCHAR(255) NOT NULL,     -- Snapshot
  sku VARCHAR(255) NOT NULL,                -- Snapshot
  unit_price_net DECIMAL(12,2) NOT NULL,    -- Snapshot
  vat_rate DECIMAL(5,4) NOT NULL,           -- Snapshot
  unit_id UUID NOT NULL REFERENCES units(id),
  unit_name VARCHAR(100) NOT NULL,          -- Snapshot
  currency_id UUID NOT NULL REFERENCES currencies(id),
  total_net DECIMAL(12,2) NOT NULL,         -- unit_price × quantity
  total_vat DECIMAL(12,2) NOT NULL,         -- total_net × vat_rate
  total_gross DECIMAL(12,2) NOT NULL,       -- total_net + total_vat
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL  -- Soft delete
);
```

**Indexes:**
- `idx_quote_accessories_quote_id` - Fast lookups by quote
- `idx_quote_accessories_deleted_at` - Efficient soft delete queries
- `idx_quote_accessories_accessory_id` - Reference integrity

**Constraints:**
- Foreign key to `quotes` with CASCADE delete
- Foreign key to `accessories` with RESTRICT delete
- Check constraint: `quantity > 0`
- RLS policies for authenticated users only

### `quotes` Table Updates

Added columns to track fees and accessories totals:

```sql
ALTER TABLE quotes ADD COLUMN fees_total_net DECIMAL(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN fees_total_vat DECIMAL(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN fees_total_gross DECIMAL(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN accessories_total_net DECIMAL(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN accessories_total_vat DECIMAL(12,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN accessories_total_gross DECIMAL(12,2) DEFAULT 0;
```

---

## Business Logic

### Calculation Formula

```typescript
// Step 1: Calculate materials with discount
const materialsGross = quote.total_gross;
const discountAmount = materialsGross × (quote.discount_percent / 100);
const materialsAfterDiscount = materialsGross - discountAmount;

// Step 2: Calculate fees (no discount)
const feesTotal = quote.fees_total_gross;

// Step 3: Calculate accessories (no discount)
const accessoriesTotal = quote.accessories_total_gross;

// Step 4: Calculate final total
const finalTotal = materialsAfterDiscount + feesTotal + accessoriesTotal;
```

### Key Business Rules

1. **Fees:**
   - Always quantity = 1 (hardcoded)
   - No discount applied
   - Can be added/removed at any time
   - Prices are snapshots at time of adding

2. **Accessories:**
   - Quantity can be any positive integer
   - No discount applied
   - Can be added/removed at any time
   - Prices are snapshots at time of adding
   - **Global updates:** Modifying accessory details updates the accessories table globally

3. **Discounts:**
   - Only apply to materials (`total_gross`)
   - Do NOT apply to fees or accessories
   - Discount percentage from customer or quote level

4. **Auto-Recalculation:**
   - When fee added/removed → recalculate fees totals → recalculate final total
   - When accessory added/removed/quantity changed → recalculate accessories totals → recalculate final total

### Snapshot Pricing

All prices are stored as **snapshots** at the time of adding to ensure historical accuracy:

- **Fee added:** Stores current `net_price`, `vat_rate` from `feetypes` table
- **Accessory added:** Stores current `net_price`, `vat_rate`, `unit_name` from `accessories` table
- **Future changes:** If fee type or accessory price changes in master tables, existing quotes remain unchanged

---

## User Interface

### Quote Detail Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [← Vissza az árajánlatokhoz]                                │
│                                                              │
│ ┌───────────────────────────────┐  ┌────────────────────┐   │
│ │ LEFT COLUMN (9/12)            │  │ RIGHT COLUMN (3/12)│   │
│ │                               │  │                    │   │
│ │ 📄 Árajánlat Card             │  │ 🔧 Műveletek       │   │
│ │ - Cégadatok                   │  │ - Opti szerkesztés │   │
│ │ - Ügyfél adatok               │  │ - Export Excel     │   │
│ │ - Számlázási adatok           │  │ - Nyomtatás        │   │
│ │ - Anyagok táblázat            │  │ - Fizetés hozzáadás│   │
│ │ - Szolgáltatások táblázat     │  │ - Megrendelés      │   │
│ │ - Árajánlat összesítése       │  │                    │   │
│ │                               │  │ ℹ️ Árajánlat info   │   │
│ ├───────────────────────────────┤  │ - Szám             │   │
│ │ 💳 DÍJAK CARD                 │  │ - Dátumok          │   │
│ │ [+ Díj hozzáadása]            │  │ - Kedvezmény       │   │
│ │ [Table with bulk select]      │  └────────────────────┘   │
│ │ [Törlés (X) button]           │                           │
│ ├───────────────────────────────┤                           │
│ │ 📦 TERMÉKEK CARD              │                           │
│ │ [+ Termék hozzáadása]         │                           │
│ │ [Table with bulk select]      │                           │
│ │ [Törlés (X) button]           │                           │
│ └───────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Díjak (Fees) Section

```
┌──────────────────────────────────────────────────────┐
│  Díjak                           [+ Díj hozzáadása]  │
│  ──────────────────────────────────────────────────  │
│  ┌──────────────────────────────────────────────┐    │
│  │ ☐ │ Díj neve  │ Nettó ár │ ÁFA   │ Bruttó ár│    │
│  ├──────────────────────────────────────────────┤    │
│  │ ☐ │ Szállítás │ 1,000 Ft │ 270 Ft│ 1,270 Ft │    │
│  │ ☐ │ SOS       │ 2,500 Ft │ 675 Ft│ 3,175 Ft │    │
│  ├──────────────────────────────────────────────┤    │
│  │   │ Összesen: │ 3,500 Ft │ 945 Ft│ 4,445 Ft │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  [Törlés (2)]  ← Only shown when items selected      │
└──────────────────────────────────────────────────────┘
```

**Features:**
- ☐ Checkbox for each row
- ☑ Select all checkbox in header
- 🗑️ Bulk delete button (appears when items selected)
- ➕ Add button opens modal
- 📊 Totals row at bottom
- 🚫 No individual delete buttons

**Empty State:**
```
┌──────────────────────────────────────────────────────┐
│  Díjak                           [+ Díj hozzáadása]  │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Még nincsenek hozzáadott díjak                      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Termékek (Accessories) Section

```
┌────────────────────────────────────────────────────────────┐
│  Termékek                     [+ Termék hozzáadása]        │
│  ────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────┐    │
│  │☐│Termék│SKU│Menny│Egys│Nettó/e│Nettó│ÁFA│Bruttó│    │  │
│  ├────────────────────────────────────────────────────┤    │
│  │☐│Csavar│001│ 10  │ db │ 50 Ft │500Ft│135│ 635Ft│    │  │
│  │☐│Fogantyú│002│ 5 │db │200 Ft│1000Ft│270│1,270Ft│   │  │
│  ├────────────────────────────────────────────────────┤    │
│  │ │      │   │     │   Összesen:│1,500│405│1,905 │    │  │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  [Törlés (2)]  ← Only shown when items selected            │
└────────────────────────────────────────────────────────────┘
```

**Features:**
- ☐ Checkbox for each row
- ☑ Select all checkbox in header
- 🗑️ Bulk delete button (appears when items selected)
- ➕ Add button opens modal
- 📊 Shows: SKU, Quantity, Unit, Unit Price, Totals
- 📊 Totals row at bottom
- 🚫 No individual delete or edit buttons

**Empty State:**
```
┌────────────────────────────────────────────────────────────┐
│  Termékek                     [+ Termék hozzáadása]        │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  Még nincsenek hozzáadott termékek                         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Árajánlat Összesítése (Summary)

```
┌──────────────────────────────────────┐
│  Anyagok összesen:    1,234,567 Ft   │
│  Kedvezmény (10%):     -123,456 Ft   │
│  Anyagok kedvezménnyel: 1,111,111 Ft │
│  ──────────────────────────────────  │
│  Díjak összesen:         10,000 Ft   │
│  Termékek összesen:      25,000 Ft   │
│  ──────────────────────────────────  │
│  Végösszeg:           1,146,111 Ft   │
└──────────────────────────────────────┘
```

**Breakdown:**
1. **Anyagok összesen** - Material gross total (before discount)
2. **Kedvezmény** - Discount amount (only on materials)
3. **Anyagok kedvezménnyel** - Materials after discount
4. **Díjak összesen** - Total fees (no discount)
5. **Termékek összesen** - Total accessories (no discount)
6. **Végösszeg** - Final grand total

---

## User Interface

### Add Fee Modal

**Simple dropdown selection with instant loading (SSR):**

```
┌──────────────────────────────────────────────┐
│  Díj hozzáadása                              │
│  ──────────────────────────────────────────  │
│                                               │
│  Díjtípus: [Select from dropdown ▼]         │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ Ár előnézet:                         │    │
│  │ Nettó ár:        1,000 Ft            │    │
│  │ ÁFA (27%):         270 Ft            │    │
│  │ ──────────────────────────────       │    │
│  │ Bruttó ár:       1,270 Ft            │    │
│  └──────────────────────────────────────┘    │
│                                               │
│  [Mégse] [Hozzáadás]                         │
└──────────────────────────────────────────────┘
```

**Features:**
- ⚡ **Instant opening** - SSR data, no loading delay
- 📋 **Simple dropdown** - Select fee type
- 💰 **Price preview** - Shows net, VAT, gross
- ✅ **One-click add** - No additional fields needed

### Add Accessory Modal (Advanced)

**All fields visible, Autocomplete with freeSolo (like customer on Opti page):**

```
┌──────────────────────────────────────────────────────┐
│  Termék hozzáadása                                   │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Termék neve *: [Autocomplete - Type or Select ▼]   │
│  ↓ (Start typing to search, or type new name)       │
│                                                       │
│  SKU *:              [____________]                  │
│  Mennyiség *:        [____1____]                     │
│  Nettó ár *:         [_________]                     │
│  ÁFA *:              [Select ▼]                      │
│  Pénznem *:          [Select ▼]                      │
│  Mértékegység *:     [Select ▼]                      │
│  Partner *:          [Select ▼]                      │
│                                                       │
│  ┌────────────────────────────────────────────┐      │
│  │ Ár előnézet:                               │      │
│  │ Nettó ár/egység:      50 Ft                │      │
│  │ Mennyiség:            10                   │      │
│  │ ──────────────────────────────────         │      │
│  │ Nettó összesen:      500 Ft                │      │
│  │ ÁFA összesen (27%):  135 Ft                │      │
│  │ ──────────────────────────────────         │      │
│  │ Bruttó összesen:     635 Ft                │      │
│  └────────────────────────────────────────────┘      │
│                                                       │
│  [Mégse] [Hozzáadás]                                 │
└──────────────────────────────────────────────────────┘
```

**Features:**
- ⚡ **Instant opening** - SSR data, no loading delay
- 🔍 **Autocomplete with freeSolo** - Type to search OR type new name
- 📝 **All fields visible** - No hidden fields
- 🔄 **Auto-fill on selection** - Select accessory → all fields populate
- ✏️ **Edit mode** - Modify fields → updates globally in accessories table
- ➕ **Create mode** - Type new name → fill fields → creates new accessory
- 📊 **Real-time preview** - Calculates totals as you type
- ✅ **Validation** - All required fields checked

---

## User Guide

### How to Add a Fee

1. Open quote detail page (`/quotes/[quote_id]`)
2. Scroll to **"Díjak"** card
3. Click **"+ Díj hozzáadása"** button
4. Modal opens **instantly** (no loading delay)
5. Select fee type from dropdown (e.g., "Szállítás")
6. Preview shows calculated price
7. Click **"Hozzáadás"**
8. ✅ Fee appears in table
9. ✅ "Díjak összesen" in summary updates
10. ✅ "Végösszeg" recalculates
11. ✅ Success toast notification appears

### How to Add an Existing Accessory

1. Open quote detail page
2. Scroll to **"Termékek"** card
3. Click **"+ Termék hozzáadása"** button
4. Modal opens **instantly** with all fields visible
5. Start typing in "Termék neve" field (e.g., "Csavar")
6. Select "Csavar 3.5x30" from dropdown
7. ✅ **All fields auto-fill:**
   - SKU: "CSVR001"
   - Nettó ár: 10
   - ÁFA: 27%
   - Pénznem: HUF
   - Mértékegység: db
   - Partner: (partner name)
8. **Optional:** Modify any field (e.g., change price to 12 Ft)
   - This will **update the accessory globally** in accessories table
9. Set quantity (e.g., 100)
10. Preview shows calculated totals
11. Click **"Hozzáadás"**
12. ✅ Accessory updated in accessories table (if modified)
13. ✅ Accessory added to quote with quantity=100
14. ✅ "Termékek összesen" in summary updates
15. ✅ "Végösszeg" recalculates
16. ✅ Success toast notification appears

### How to Create a New Accessory

1. Open quote detail page
2. Scroll to **"Termékek"** card
3. Click **"+ Termék hozzáadása"** button
4. Modal opens **instantly** with all fields visible
5. Type new accessory name (e.g., "Polctartó alumínium")
6. Fill in all required fields:
   - **SKU:** "POLC100"
   - **Mennyiség:** 20
   - **Nettó ár:** 250
   - **ÁFA:** 27% (select from dropdown)
   - **Pénznem:** HUF (select from dropdown)
   - **Mértékegység:** db (select from dropdown)
   - **Partner:** Select from dropdown
7. Preview shows calculated totals
8. Click **"Hozzáadás"**
9. ✅ **New accessory created** in accessories table
10. ✅ **Added to quote** with quantity=20
11. ✅ "Termékek összesen" in summary updates
12. ✅ "Végösszeg" recalculates
13. ✅ Success toast notification appears

### How to Delete Fees (Bulk)

1. In **"Díjak"** card, check boxes next to fees you want to delete
2. **"Törlés (X)"** button appears showing count
3. Click **"Törlés (2)"** button
4. Confirmation modal appears
5. Click **"Törlés"** to confirm
6. ✅ Selected fees deleted
7. ✅ Totals recalculated
8. ✅ Success toast notification appears

### How to Delete Accessories (Bulk)

1. In **"Termékek"** card, check boxes next to accessories you want to delete
2. **"Törlés (X)"** button appears showing count
3. Click **"Törlés (3)"** button
4. Confirmation modal appears
5. Click **"Törlés"** to confirm
6. ✅ Selected accessories deleted
7. ✅ Totals recalculated
8. ✅ Success toast notification appears

---

## API Endpoints

### Fees API

#### `GET /api/quotes/[quote_id]/fees`
Fetch all fees for a quote.

**Response:**
```json
[
  {
    "id": "uuid",
    "fee_name": "Szállítás",
    "unit_price_net": 1000,
    "vat_rate": 0.27,
    "vat_amount": 270,
    "gross_price": 1270,
    "currency_id": "uuid",
    "created_at": "2025-01-27T10:00:00Z"
  }
]
```

#### `POST /api/quotes/[quote_id]/fees`
Add a fee to a quote.

**Request:**
```json
{
  "feetype_id": "uuid"
}
```

**Response:**
```json
{
  "id": "uuid",
  "fee_name": "Szállítás",
  ...
}
```

**Side Effects:**
- Creates record in `quote_fees` table
- Recalculates `fees_total_net/vat/gross` in quotes table
- Recalculates `final_total_after_discount`

#### `DELETE /api/quotes/[quote_id]/fees/[fee_id]`
Remove a fee from a quote (soft delete).

**Response:**
```json
{
  "success": true
}
```

**Side Effects:**
- Sets `deleted_at` timestamp
- Recalculates fees totals
- Recalculates final total

### Accessories API

#### `GET /api/quotes/[quote_id]/accessories`
Fetch all accessories for a quote.

**Response:**
```json
[
  {
    "id": "uuid",
    "accessory_name": "Csavar 3.5x30",
    "sku": "CSVR001",
    "quantity": 10,
    "unit_price_net": 50,
    "unit_name": "darab",
    "total_net": 500,
    "total_vat": 135,
    "total_gross": 635,
    ...
  }
]
```

#### `POST /api/quotes/[quote_id]/accessories`
Add an accessory to a quote.

**Request:**
```json
{
  "accessory_id": "uuid",
  "quantity": 10
}
```

**Response:**
```json
{
  "id": "uuid",
  "accessory_name": "Csavar 3.5x30",
  "quantity": 10,
  ...
}
```

**Side Effects:**
- Creates record in `quote_accessories` table
- Recalculates `accessories_total_net/vat/gross` in quotes table
- Recalculates `final_total_after_discount`

#### `PATCH /api/quotes/[quote_id]/accessories/[accessory_id]`
Update accessory quantity.

**Request:**
```json
{
  "quantity": 20
}
```

**Response:**
```json
{
  "id": "uuid",
  "quantity": 20,
  "total_net": 1000,
  "total_vat": 270,
  "total_gross": 1270
}
```

**Side Effects:**
- Updates quantity and recalculates totals
- Recalculates accessories totals in quotes table
- Recalculates final total

#### `DELETE /api/quotes/[quote_id]/accessories/[accessory_id]`
Remove an accessory from a quote (soft delete).

**Response:**
```json
{
  "success": true
}
```

**Side Effects:**
- Sets `deleted_at` timestamp
- Recalculates accessories totals
- Recalculates final total

### Accessories Master Table API

#### `PUT /api/accessories/[accessory_id]`
Update an accessory in the master accessories table (global update).

**Request:**
```json
{
  "name": "Csavar 3.5x30",
  "sku": "CSVR001",
  "net_price": 12,
  "vat_id": "uuid",
  "currency_id": "uuid",
  "units_id": "uuid",
  "partners_id": "uuid"
}
```

**Usage:**
- Called from Add Accessory Modal when user modifies existing accessory
- Updates the master record globally
- Does NOT affect existing quotes (they use snapshots)
- Affects future quotes that use this accessory

---

## Implementation Details

### Server-Side Rendering (SSR)

#### Page Load Sequence

```typescript
// /quotes/[quote_id]/page.tsx

const [
  quoteData,      // Quote with fees & accessories
  feeTypes,       // All fee types
  accessories,    // All accessories
  vatRates,       // All VAT rates
  currencies,     // All currencies
  units,          // All units
  partners        // All partners
] = await Promise.all([
  getQuoteById(quoteId),
  getAllFeeTypes(),
  getAllAccessories(),
  getAllVatRates(),
  getAllCurrencies(),
  getAllUnits(),
  getAllPartners()
])
```

**Performance:**
- All queries run in **parallel** on server
- Total SSR time: ~200-800ms (depends on data size)
- Client receives all data immediately
- **No client-side fetching** when modals open

#### Performance Comparison

**Before (Client-Side Fetching):**
```
User clicks "+ Díj hozzáadása"
  → Modal opens
  → useEffect triggers
  → fetch('/api/feetypes') → 1446ms
  → Modal displays data
Total: ~1.5 seconds delay
```

**After (SSR):**
```
User clicks "+ Díj hozzáadása"
  → Modal opens instantly
  → Data already in props
Total: ~0ms delay
```

**Speed Improvement:** 1.5 seconds faster per modal opening

### Component Architecture

```
QuoteDetailPage (SSR)
  ↓
  ├─ Fetches: quote, fees, accessories, feeTypes, accessories, vat, currencies, units, partners
  ↓
QuoteDetailClient (Client Component)
  ├─ Props: All SSR data
  ├─ State: quoteData, modal visibility
  ├─ Functions: refresh, add handlers
  ↓
  ├─ QuoteFeesSection
  │   ├─ Props: quoteId, fees, callbacks
  │   ├─ Features: Table, bulk select, bulk delete
  │   └─ No individual operations
  │
  ├─ QuoteAccessoriesSection
  │   ├─ Props: quoteId, accessories, callbacks
  │   ├─ Features: Table, bulk select, bulk delete
  │   └─ No individual operations
  │
  ├─ AddFeeModal
  │   ├─ Props: feeTypes (SSR data)
  │   ├─ Features: Dropdown, preview, add
  │   └─ No loading states
  │
  └─ AddAccessoryModal
      ├─ Props: accessories, vat, currencies, units, partners (SSR data)
      ├─ Features: Autocomplete freeSolo, all fields, preview
      ├─ Modes: Select existing, Edit existing, Create new
      └─ No loading states
```

### Autocomplete Implementation (Accessory Modal)

Based on Opti page customer selector pattern:

```typescript
<Autocomplete
  fullWidth
  freeSolo  // ← KEY: Allows typing new values
  options={accessories}
  getOptionLabel={(option) => 
    typeof option === 'string' ? option : option.name
  }
  value={selectedAccessory}
  
  // Handle selection/typing
  onChange={(event, newValue) => {
    if (typeof newValue === 'string') {
      // User typed a new name
      setSelectedAccessory(null)
      setAccessoryData({
        name: newValue,
        sku: '',
        net_price: 0,
        vat_id: '',
        currency_id: '',
        units_id: '',
        partners_id: '',
        quantity: 1
      })
    } else if (newValue) {
      // User selected existing accessory
      setSelectedAccessory(newValue)
      setAccessoryData({
        name: newValue.name,
        sku: newValue.sku,
        net_price: newValue.net_price,
        vat_id: newValue.vat_id,
        currency_id: newValue.currency_id,
        units_id: newValue.units_id,
        partners_id: newValue.partners_id,
        quantity: 1
      })
    } else {
      // Cleared
      reset()
    }
  }}
  
  // Handle typing new name
  onInputChange={(event, newInputValue) => {
    if (event && newInputValue && 
        !accessories.find(a => a.name === newInputValue)) {
      // User is typing a new name
      setSelectedAccessory(null)
      setAccessoryData(prev => ({
        ...prev,
        name: newInputValue
      }))
    }
  }}
  
  renderInput={(params) => (
    <TextField
      {...params}
      label="Termék neve (válasszon vagy írjon be új nevet) *"
      required
    />
  )}
/>
```

### Add Accessory Logic Flow

```typescript
async function handleSubmit() {
  // Validate all fields
  if (!name || !sku || !net_price || !vat_id || 
      !currency_id || !units_id || !partners_id || quantity < 1) {
    toast.error('Kérjük, töltse ki az összes mezőt!')
    return
  }

  let accessoryId = selectedAccessory?.id

  // CASE 1: User selected existing and modified fields
  if (selectedAccessory && hasDataChanged()) {
    // Update accessories table globally
    await PUT /api/accessories/[id] {
      name, sku, net_price, vat_id, 
      currency_id, units_id, partners_id
    }
    accessoryId = selectedAccessory.id
  }
  
  // CASE 2: User typed new accessory name
  else if (!selectedAccessory) {
    // Create new accessory in accessories table
    const created = await POST /api/accessories {
      name, sku, net_price, vat_id, 
      currency_id, units_id, partners_id
    }
    accessoryId = created.id
  }
  
  // CASE 3: User selected existing without changes
  else {
    accessoryId = selectedAccessory.id
  }

  // Add to quote with snapshot pricing
  await POST /api/quotes/[quote_id]/accessories {
    accessory_id: accessoryId,
    quantity: quantity
  }
  
  // Refresh quote data
  refreshQuoteData()
}
```

### Auto-Recalculation Logic

```typescript
async function recalculateQuoteTotals(quoteId: string) {
  // 1. Get all fees
  const fees = await SELECT FROM quote_fees 
    WHERE quote_id = quoteId AND deleted_at IS NULL

  // 2. Get all accessories
  const accessories = await SELECT FROM quote_accessories 
    WHERE quote_id = quoteId AND deleted_at IS NULL

  // 3. Calculate fees totals
  const feesTotalNet = SUM(fees.unit_price_net)
  const feesTotalVat = SUM(fees.vat_amount)
  const feesTotalGross = SUM(fees.gross_price)

  // 4. Calculate accessories totals
  const accessoriesTotalNet = SUM(accessories.total_net)
  const accessoriesTotalVat = SUM(accessories.total_vat)
  const accessoriesTotalGross = SUM(accessories.total_gross)

  // 5. Get current quote
  const quote = await SELECT total_net, total_vat, total_gross, 
                             discount_percent FROM quotes 
                WHERE id = quoteId

  // 6. Calculate final total with discount
  const discountMultiplier = 1 - (quote.discount_percent / 100)
  const materialsAfterDiscount = quote.total_gross × discountMultiplier
  const finalTotal = materialsAfterDiscount + 
                     feesTotalGross + 
                     accessoriesTotalGross

  // 7. Update quote
  await UPDATE quotes SET
    fees_total_net = feesTotalNet,
    fees_total_vat = feesTotalVat,
    fees_total_gross = feesTotalGross,
    accessories_total_net = accessoriesTotalNet,
    accessories_total_vat = accessoriesTotalVat,
    accessories_total_gross = accessoriesTotalGross,
    final_total_after_discount = finalTotal
  WHERE id = quoteId
}
```

**Called Automatically:**
- When fee added
- When fee deleted
- When accessory added
- When accessory quantity updated
- When accessory deleted

---

## Technical Specifications

### Data Flow

```
1. Page Load (SSR)
   ↓
   Server fetches: quote + all catalog data
   ↓
   Props passed to client component
   ↓
   Instant modal opening

2. Add Fee
   ↓
   User selects fee type (already loaded)
   ↓
   POST /api/quotes/[id]/fees
   ↓
   Creates quote_fees record
   ↓
   Auto-recalculates totals
   ↓
   GET /api/quotes/[id] to refresh
   ↓
   UI updates

3. Add Accessory (Existing)
   ↓
   User selects from autocomplete
   ↓
   Fields auto-fill
   ↓
   User optionally modifies fields
   ↓
   If modified: PUT /api/accessories/[id]
   ↓
   POST /api/quotes/[id]/accessories
   ↓
   Auto-recalculates totals
   ↓
   GET /api/quotes/[id] to refresh
   ↓
   UI updates

4. Add Accessory (New)
   ↓
   User types new name
   ↓
   User fills all fields
   ↓
   POST /api/accessories (creates new)
   ↓
   POST /api/quotes/[id]/accessories
   ↓
   Auto-recalculates totals
   ↓
   GET /api/quotes/[id] to refresh
   ↓
   UI updates
```

### State Management

```typescript
// QuoteDetailClient state
const [quoteData, setQuoteData] = useState<QuoteData>(initialQuoteData)
const [addFeeModalOpen, setAddFeeModalOpen] = useState(false)
const [addAccessoryModalOpen, setAddAccessoryModalOpen] = useState(false)

// AddAccessoryModal state
const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null)
const [accessoryData, setAccessoryData] = useState({
  name: '',
  sku: '',
  net_price: 0,
  vat_id: '',
  currency_id: '',
  units_id: '',
  partners_id: '',
  quantity: 1
})
```

### Validation Rules

#### Fees:
- ✅ `feetype_id` required
- ✅ Must exist in `feetypes` table
- ✅ Must not be soft-deleted

#### Accessories:
- ✅ `name` required (must be non-empty)
- ✅ `sku` required (must be non-empty and unique)
- ✅ `net_price` required (must be > 0)
- ✅ `vat_id` required (must exist in `vat` table)
- ✅ `currency_id` required (must exist in `currencies` table)
- ✅ `units_id` required (must exist in `units` table)
- ✅ `partners_id` required (must exist in `partners` table)
- ✅ `quantity` required (must be >= 1)

### Error Handling

**Client-Side:**
- Form validation before submission
- Toast notifications for all errors
- Loading states during API calls
- Confirmation modals for destructive actions

**Server-Side:**
- Try-catch blocks around all database operations
- Proper HTTP status codes (200, 201, 400, 404, 500)
- Detailed error messages in logs
- Transaction rollback on errors

---

## Performance Optimization

### SSR Performance

**Metrics from Production:**
```
Fee Types DB Query:    108.41ms (fetched 2 records)
Accessories DB Query:  206.21ms (fetched 3 records)
VAT DB Query:          182.56ms (fetched 4 records)
Currencies DB Query:   187.31ms (fetched 3 records)
Units DB Query:        196.16ms (fetched 6 records)
Partners DB Query:     199.18ms (fetched 3 records)
Quote DB Query:        204.84ms (fetched quote)
Panels DB Query:       113.57ms (fetched 3 panels)
Pricing DB Query:      127.88ms (fetched 3 pricing)
Fees DB Query:         119.83ms (fetched 1 fees)
Accessories DB Query:  111.27ms (fetched 2 accessories)
Tenant Company:        115.17ms (fetched 1 record)

Total SSR Time:        ~793ms
Page Load:             ~866ms
```

**Optimizations:**
- ✅ Parallel queries with `Promise.all()`
- ✅ Indexed columns for fast lookups
- ✅ Only select needed columns
- ✅ Efficient JOIN queries
- ✅ Soft delete index for fast filtering

### Client-Side Performance

**Modal Opening:**
- Before: 1400ms+ (client-side fetch)
- After: 0ms (SSR data in props)
- Improvement: **Instant**

**Bulk Operations:**
- Delete multiple items with `Promise.allSettled()`
- Progress tracking
- Partial failure handling

---

## Testing Guide

### Manual Testing Checklist

#### Fees Testing
- [ ] Open quote detail page
- [ ] Verify "Díjak" card visible
- [ ] Click "+ Díj hozzáadása"
- [ ] Verify modal opens **instantly** (no delay)
- [ ] Select "Szállítás" from dropdown
- [ ] Verify price preview shows: Nettó 1,000, ÁFA 270, Bruttó 1,270
- [ ] Click "Hozzáadás"
- [ ] Verify success toast appears
- [ ] Verify fee appears in table
- [ ] Verify "Díjak összesen" in summary shows 1,270 Ft
- [ ] Verify "Végösszeg" updated
- [ ] Check fee row checkbox
- [ ] Verify "Törlés (1)" button appears
- [ ] Click "Törlés (1)"
- [ ] Confirm deletion
- [ ] Verify fee removed
- [ ] Verify totals updated
- [ ] Verify success toast appears

#### Accessories Testing - Select Existing
- [ ] Open quote detail page
- [ ] Verify "Termékek" card visible
- [ ] Click "+ Termék hozzáadása"
- [ ] Verify modal opens **instantly** with all fields visible
- [ ] Start typing "Csavar" in autocomplete
- [ ] Select "Csavar 3.5x30"
- [ ] Verify all fields auto-fill: SKU, Price, VAT, Currency, Unit, Partner
- [ ] Change price from 10 to 12 Ft
- [ ] Set quantity to 100
- [ ] Verify preview shows: Nettó 1,200, ÁFA 324, Bruttó 1,524
- [ ] Click "Hozzáadás"
- [ ] Verify success toast appears
- [ ] Verify accessory appears in table with quantity 100
- [ ] Verify "Termékek összesen" in summary shows 1,524 Ft
- [ ] Verify "Végösszeg" updated
- [ ] Go to /accessories page
- [ ] Verify "Csavar 3.5x30" now has price 12 Ft (global update)

#### Accessories Testing - Create New
- [ ] Click "+ Termék hozzáadása"
- [ ] Type "Új termék teszt" in autocomplete (doesn't exist)
- [ ] Verify all fields remain empty/editable
- [ ] Fill in all fields:
  - SKU: "TEST001"
  - Nettó ár: 500
  - ÁFA: 27%
  - Pénznem: HUF
  - Mértékegység: db
  - Partner: Select any
- [ ] Set quantity to 5
- [ ] Verify preview shows calculated totals
- [ ] Click "Hozzáadás"
- [ ] Verify success toast appears
- [ ] Verify accessory appears in table
- [ ] Verify totals updated
- [ ] Go to /accessories page
- [ ] Verify "Új termék teszt" exists in accessories table

#### Bulk Delete Testing
- [ ] Add 3 fees to a quote
- [ ] Check all 3 checkboxes
- [ ] Click "Törlés (3)"
- [ ] Confirm deletion
- [ ] Verify all 3 deleted
- [ ] Verify totals recalculated
- [ ] Add 3 accessories to a quote
- [ ] Check 2 checkboxes
- [ ] Click "Törlés (2)"
- [ ] Confirm deletion
- [ ] Verify selected 2 deleted, 1 remains
- [ ] Verify totals recalculated

#### Totals Calculation Testing
- [ ] Create quote with materials total: 100,000 Ft
- [ ] Set discount to 10%
- [ ] Verify materials after discount: 90,000 Ft
- [ ] Add fee "Szállítás" (1,270 Ft)
- [ ] Verify "Díjak összesen": 1,270 Ft
- [ ] Verify final total: 91,270 Ft
- [ ] Add accessory (635 Ft)
- [ ] Verify "Termékek összesen": 635 Ft
- [ ] Verify final total: 91,905 Ft
- [ ] Formula: 90,000 + 1,270 + 635 = 91,905 ✓

---

## Security

### Row Level Security (RLS)

Both `quote_fees` and `quote_accessories` tables have RLS enabled:

```sql
-- Read access
CREATE POLICY "Enable read access for authenticated users" 
  ON quote_fees FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Insert access
CREATE POLICY "Enable insert for authenticated users" 
  ON quote_fees FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Update access
CREATE POLICY "Enable update for authenticated users" 
  ON quote_fees FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Delete access
CREATE POLICY "Enable delete for authenticated users" 
  ON quote_fees FOR DELETE 
  USING (auth.role() = 'authenticated');
```

### Data Integrity

- ✅ Foreign key constraints prevent invalid references
- ✅ CASCADE delete on quote deletion
- ✅ RESTRICT delete on fee type/accessory deletion
- ✅ Check constraints enforce quantity > 0
- ✅ Soft delete preserves data for audit trail
- ✅ Timestamps track all changes
- ✅ Unique constraints on SKU in accessories table

---

## Troubleshooting

### Common Issues

**Issue: Modal takes long to load**
- **Cause:** Not using SSR data
- **Solution:** Ensure props are passed from page.tsx
- **Verify:** Check that modal receives `feeTypes` or `accessories` as props

**Issue: Totals not updating**
- **Cause:** `recalculateQuoteTotals()` not called
- **Solution:** Ensure all API endpoints call this function
- **Verify:** Check server logs for calculation logs

**Issue: Accessory not updating globally**
- **Cause:** PUT request failing
- **Solution:** Check SKU uniqueness, required fields
- **Verify:** Check browser console and server logs

**Issue: Discount applied to fees/accessories**
- **Cause:** Incorrect calculation formula
- **Solution:** Verify `final_total_after_discount` calculation
- **Verify:** Check that discount only multiplies materials total

### Debug Checklist

1. **Check Server Logs:**
   - SSR fetch times
   - API request/response logs
   - Database query performance

2. **Check Browser Console:**
   - Network tab for API calls
   - Console tab for errors
   - React DevTools for state

3. **Check Database:**
   - Verify tables exist
   - Verify RLS policies enabled
   - Verify data inserted correctly

4. **Check Calculations:**
   - Materials total
   - Discount amount
   - Fees total
   - Accessories total
   - Final total formula

---

## Migration Guide

### For Existing Quotes

Existing quotes without fees or accessories:
- Will show empty states in new sections
- Can add fees/accessories retroactively
- Totals will recalculate correctly
- No data migration needed

### For Existing Accessories

If you have existing accessories in the `accessories` table:
- They can be selected in the modal
- Fields will auto-fill
- Can be modified from quote page (global update)
- Can still be edited in `/accessories` page

---

## Future Enhancements

### Potential Improvements

1. **Fees:**
   - Add search/filter in fee selection modal
   - Add custom fee creation (like accessories)
   - Add fee quantity support (currently always 1)

2. **Accessories:**
   - Add inline quantity editing in table (without modal)
   - Add accessory categories for better organization
   - Add inventory tracking
   - Add bulk import from Excel

3. **Reporting:**
   - Export fees and accessories to Excel
   - Fees/accessories summary reports
   - Historical pricing analysis

4. **UX:**
   - Drag-and-drop reordering
   - Copy fees/accessories from another quote
   - Templates for common fee/accessory combinations

---

## File Structure

```
starter-kit/
├── create_quote_fees_table.sql
├── create_quote_accessories_table.sql
├── alter_quotes_table_for_fees_accessories.sql
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   └── quotes/
│   │   │       └── [quote_id]/
│   │   │           ├── page.tsx (SSR)
│   │   │           ├── QuoteDetailClient.tsx
│   │   │           ├── QuoteFeesSection.tsx
│   │   │           ├── QuoteAccessoriesSection.tsx
│   │   │           ├── AddFeeModal.tsx
│   │   │           └── AddAccessoryModal.tsx
│   │   └── api/
│   │       └── quotes/
│   │           └── [id]/
│   │               ├── fees/
│   │               │   ├── route.ts
│   │               │   └── [feeId]/
│   │               │       └── route.ts
│   │               └── accessories/
│   │                   ├── route.ts
│   │                   └── [accessoryId]/
│   │                       └── route.ts
│   └── lib/
│       └── supabase-server.ts (getQuoteById updated)
└── docs/
    ├── FEES_ACCESSORIES_COMPLETE_GUIDE_2025-01-27.md (this file)
    ├── FEES_ACCESSORIES_FEATURE_2025-01-27.md
    └── chat-archives/
        └── 2025-01-27-fees-accessories-implementation.md
```

---

## Summary

The fees and accessories management system is a comprehensive solution that:

1. ✅ **Allows flexible quote customization** with fees and accessories
2. ✅ **Maintains pricing integrity** through snapshots
3. ✅ **Provides fast user experience** with SSR optimization
4. ✅ **Supports global updates** for accessories from quote page
5. ✅ **Enables bulk operations** for efficiency
6. ✅ **Calculates totals automatically** with correct discount logic
7. ✅ **Follows established patterns** (Opti page customer selector)
8. ✅ **Maintains data security** with RLS and soft deletes

**Ready for production use with full documentation and testing support.**

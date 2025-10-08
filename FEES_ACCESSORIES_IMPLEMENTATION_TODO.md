# Fees and Accessories Implementation - Manual Steps Required

**Date:** January 27, 2025  
**Status:** Backend Ready - Manual SQL Execution Required  

## 🔴 IMPORTANT: Manual Steps Required

### **Step 1: Run SQL Scripts (IN ORDER)**

You must manually run these SQL scripts in Supabase SQL Editor:

1. **First:** `create_quote_fees_table.sql`
   - Creates `quote_fees` table
   - Sets up indexes and RLS policies

2. **Second:** `create_quote_accessories_table.sql`
   - Creates `quote_accessories` table
   - Sets up indexes and RLS policies

3. **Third:** `alter_quotes_table_for_fees_accessories.sql`
   - Adds totals columns to `quotes` table
   - Adds comments

### **Step 2: Verify Tables Created**

Run this query to verify:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('quote_fees', 'quote_accessories');

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'quotes' 
AND column_name LIKE '%fees%' OR column_name LIKE '%accessories%';
```

## ✅ What's Already Implemented

### **Backend (API Routes)**
- ✅ `POST /api/quotes/[id]/fees` - Add fee to quote
- ✅ `GET /api/quotes/[id]/fees` - Get all fees for quote
- ✅ `DELETE /api/quotes/[id]/fees/[feeId]` - Remove fee
- ✅ `POST /api/quotes/[id]/accessories` - Add accessory to quote
- ✅ `GET /api/quotes/[id]/accessories` - Get all accessories for quote
- ✅ `PATCH /api/quotes/[id]/accessories/[accessoryId]` - Update quantity
- ✅ `DELETE /api/quotes/[id]/accessories/[accessoryId]` - Remove accessory

### **Server-Side Rendering**
- ✅ Updated `getQuoteById()` in `supabase-server.ts`
- ✅ Fetches fees and accessories with quote data
- ✅ Includes totals in response

### **Auto-Calculation**
- ✅ Totals auto-recalculate when fees/accessories added/removed/updated
- ✅ Discount only applies to materials (not fees/accessories)
- ✅ Final total = (materials_with_discount) + fees + accessories

## 🚧 TODO: Frontend Implementation

### **1. Quote Detail Page UI Components**

Need to create:

#### **A. Fees Section Card**
```
┌─────────────────────────────────────────────────────┐
│  Díjak                           [+ Díj hozzáadása] │
│  ─────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────┐    │
│  │ ☐ Díj neve     │ Nettó  │ ÁFA   │ Bruttó │🗑│    │
│  ├─────────────────────────────────────────────┤    │
│  │ ☐ Szállítás    │ 1,000  │  270  │ 1,270  │🗑│    │
│  │ ☐ SOS          │ 2,500  │  675  │ 3,175  │🗑│    │
│  └─────────────────────────────────────────────┘    │
│  Összesen:          3,500 Ft  945 Ft  4,445 Ft      │
│  [Kijelöltek törlése (2)]                            │
└─────────────────────────────────────────────────────┘
```

Features:
- ✅ Select all / bulk select
- ✅ Bulk delete
- ✅ "+ Díj hozzáadása" button opens modal
- ✅ Delete individual fee
- ✅ Show totals at bottom

#### **B. Accessories Section Card**
```
┌─────────────────────────────────────────────────────┐
│  Termékek                     [+ Termék hozzáadása] │
│  ─────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────┐    │
│  │☐│Termék│Menny│Egys│Nettó/e│Nettó│ÁFA│Bruttó│🗑│ │
│  ├─────────────────────────────────────────────┤    │
│  │☐│Csavar│ 10  │ db │  50Ft │500Ft│135│ 635Ft│🗑│ │
│  │☐│Fogantyú│ 5 │ db │200Ft│1000Ft│270│1,270Ft│🗑│ │
│  └─────────────────────────────────────────────┘    │
│  Összesen:                1,500 Ft 405Ft 1,905 Ft   │
│  [Kijelöltek törlése (2)]                            │
└─────────────────────────────────────────────────────┘
```

Features:
- ✅ Select all / bulk select
- ✅ Bulk delete
- ✅ "+ Termék hozzáadása" button opens modal
- ✅ Edit quantity inline
- ✅ Delete individual accessory
- ✅ Show totals at bottom

#### **C. Updated Summary Card**
```
┌─────────────────────────────────────────────────────┐
│  Árajánlat összesítése                              │
│  ─────────────────────────────────────────────────  │
│  Anyagok összesen:        1,234,567 Ft              │
│  Kedvezmény (10%):         -123,456 Ft              │
│  Anyagok kedvezménnyel:  1,111,111 Ft              │
│  ─────────────────────────────────────────────────  │
│  Díjak összesen:             10,000 Ft              │
│  Termékek összesen:          25,000 Ft              │
│  ─────────────────────────────────────────────────  │
│  Végösszeg (Nettó):       1,146,111 Ft              │
│  ÁFA (27%):                 309,450 Ft              │
│  Végösszeg (Bruttó):      1,455,561 Ft              │
└─────────────────────────────────────────────────────┘
```

### **2. Add Fee Modal**
- Dropdown to select fee type (from `/api/feetypes`)
- Show price preview
- Save button

### **3. Add Accessory Modal**
- Search/dropdown to select accessory (from `/api/accessories`)
- Quantity input
- Show unit and price preview
- Save button

## 📋 Implementation Checklist

### Phase 1: Database (Manual)
- [ ] Run `create_quote_fees_table.sql`
- [ ] Run `create_quote_accessories_table.sql`
- [ ] Run `alter_quotes_table_for_fees_accessories.sql`
- [ ] Verify tables created successfully

### Phase 2: Frontend Components
- [ ] Create `QuoteFeesSection.tsx` component
- [ ] Create `QuoteAccessoriesSection.tsx` component
- [ ] Create `AddFeeModal.tsx` component
- [ ] Create `AddAccessoryModal.tsx` component
- [ ] Update `QuoteDetailClient.tsx` to include new sections
- [ ] Update summary card calculations

### Phase 3: Testing
- [ ] Test adding fees
- [ ] Test removing fees
- [ ] Test bulk delete fees
- [ ] Test adding accessories
- [ ] Test updating accessory quantity
- [ ] Test removing accessories
- [ ] Test bulk delete accessories
- [ ] Verify totals calculation
- [ ] Verify discount only applies to materials

### Phase 4: Documentation
- [ ] Update user guide
- [ ] Document fees and accessories workflow
- [ ] Add screenshots

## 🔧 Technical Details

### **Calculation Logic**
```typescript
// Materials with discount
const materialsGross = quote.total_gross;
const discount = materialsGross * (quote.discount_percent / 100);
const materialsAfterDiscount = materialsGross - discount;

// Fees (no discount)
const feesTotal = quote.fees_total_gross;

// Accessories (no discount)
const accessoriesTotal = quote.accessories_total_gross;

// Grand total
const grandTotal = materialsAfterDiscount + feesTotal + accessoriesTotal;
```

### **Data Flow**
1. User adds fee/accessory → API creates record
2. API recalculates quote totals automatically
3. Frontend refreshes to show new totals
4. User can bulk delete or individual delete
5. Totals auto-update on any change

## 📝 Notes

- Fees always have quantity = 1
- Accessories can have quantity > 1
- Discount only applies to materials
- Fees and accessories can be edited after order creation
- All prices are snapshots at time of adding
- Soft delete is used (deleted_at column)
- SSR fetches fees and accessories with quote
- Bulk operations use select all / individual selection

## 🚀 Next Steps

1. **YOU MUST RUN THE SQL SCRIPTS MANUALLY**
2. After tables are created, we can implement the frontend
3. Don't commit to git yet (as requested)

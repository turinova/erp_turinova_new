# Simplified Order System - Final Design
**Date:** 2025-01-28  
**Status:** Ready to implement

---

## ✅ **Simple Design - No Duplication!**

### **Core Principle:**
- **Orders ARE quotes** with `status = 'ordered'` or higher
- **No separate orders table** - just enhance quotes table
- **Payments link to quotes** - via `quote_payments` table

---

## 📊 **Database Schema**

### **Enhanced Quotes Table:**
```sql
quotes
├─ (existing columns...)
├─ status TEXT                    -- draft, ordered, in_production, ready, finished
├─ order_number TEXT UNIQUE       -- ORD-2025-01-28-001 (generated when ordered)
├─ barcode TEXT UNIQUE            -- Production tracking
├─ production_machine_id UUID     -- FK to production_machines
├─ production_date DATE           -- Scheduled production date
└─ payment_status TEXT            -- not_paid, partial, paid (auto-calculated)
```

### **Quote Payments Table:**
```sql
quote_payments
├─ id UUID
├─ quote_id UUID                  -- FK to quotes
├─ amount NUMERIC
├─ payment_method TEXT            -- cash, transfer, card
├─ comment TEXT
├─ payment_date TIMESTAMP
├─ created_by UUID
└─ deleted_at TIMESTAMP
```

### **Dropped Tables:**
- ❌ `orders` - Unnecessary duplication
- ❌ `order_status_history` - Can add later if needed
- ❌ `order_payments` - Renamed to `quote_payments`

---

## 🔄 **Workflow**

### **Step 1: Quote Creation**
```
User creates quote → status = 'draft'
order_number = NULL
payment_status = 'not_paid'
```

### **Step 2: Convert to Order**
```
User clicks "Megrendelés" button
↓
Modal opens:
- Befizetett összeg (amount)
- Fizetési mód (cash/transfer/card)
- Megjegyzés (comment)
↓
User clicks "Megrendelés" in modal
↓
System does:
1. Generate order_number = "ORD-2025-01-28-001"
2. Update quotes.order_number = "ORD-2025-01-28-001"
3. Update quotes.status = 'ordered'
4. Insert into quote_payments (if amount > 0)
5. Trigger updates quotes.payment_status automatically
6. Redirect to /orders/[same-quote-id]
```

### **Step 3: Production Assignment**
```
User clicks "Gyártásba adás" button
↓
Modal opens:
- Gép (machine dropdown)
- Gyártás dátuma (date picker)
- Vonalkód (barcode input)
↓
User clicks "Mentés"
↓
System does:
1. Update quotes.production_machine_id = selected
2. Update quotes.production_date = selected
3. Update quotes.barcode = entered
4. Update quotes.status = 'in_production'
5. Close modal, refresh page
```

### **Step 4: Add More Payments**
```
User clicks "Fizetés hozzáadás"
↓
Modal opens (same as initial payment)
↓
User enters amount, method, comment
↓
System does:
1. Insert into quote_payments
2. Trigger auto-updates payment_status
3. Close modal, refresh page
```

---

## 📄 **Pages Structure**

### **1. Quotes List Page (`/quotes`)**
**Shows:** Only drafts
```sql
SELECT * FROM quotes 
WHERE status = 'draft' 
  AND deleted_at IS NULL
ORDER BY created_at DESC
```

**Columns:**
- Quote Number
- Customer Name
- Total
- Updated At

### **2. Orders List Page (`/orders`)**
**Shows:** Ordered and beyond
```sql
SELECT * FROM quotes 
WHERE status IN ('ordered', 'in_production', 'ready', 'finished')
  AND deleted_at IS NULL
ORDER BY created_at DESC
```

**Columns:**
- Order Number
- Customer Name
- Total
- Payment Status
- Order Status
- Date

### **3. Quote Detail Page (`/quotes/[id]`)**
**Shows when:** `status = 'draft'`

**Buttons:**
- ✅ Opti szerkesztés
- ✅ Kedvezmény
- ✅ Export Excel
- ✅ Nyomtatás
- ✅ **Megrendelés** ← Main action

### **4. Order Detail Page (`/orders/[id]`)**
**Shows when:** `status != 'draft'`

**Same page as quotes detail, but different buttons:**

**When `status = 'ordered'`:**
- ✅ Opti szerkesztés
- ✅ Kedvezmény
- ✅ Export Excel
- ✅ Nyomtatás
- ✅ **Gyártásba adás** ← New button
- ✅ **Fizetés hozzáadás** ← New button

**When `status = 'in_production'` or higher:**
- 🔒 Opti szerkesztés (disabled)
- 🔒 Kedvezmény (disabled)
- ✅ Export Excel
- ✅ Nyomtatás
- ✅ **Fizetés hozzáadás**

---

## 🎯 **Status Flow**

```
draft 
  ↓ (Megrendelés button)
ordered 
  ↓ (Gyártásba adás button)
in_production 
  ↓ (Later: barcode scan or manual)
ready 
  ↓ (Later: barcode scan or manual)
finished
```

---

## ⚡ **Performance Benefits**

1. ✅ **Fewer joins** - No need to join orders table
2. ✅ **Simpler queries** - Just filter quotes by status
3. ✅ **Faster lookups** - Indexed status column
4. ✅ **Less storage** - No data duplication
5. ✅ **Auto-calculated payment_status** - Trigger handles it

---

## 🗂️ **Implementation Files**

### **SQL:**
- `cleanup_and_enhance_quotes.sql` - Run this to update schema

### **API Routes:**
- `/api/quotes` - Update to handle order_number generation
- `/api/quotes/[id]/payments` - Add/list payments
- `/api/quotes/[id]/production` - Assign to production

### **Frontend Pages:**
- `/quotes` - List drafts
- `/orders` - List orders (NEW)
- `/quotes/[id]` - Detail for drafts
- `/orders/[id]` - Detail for orders (same component, different URL)

### **Components:**
- `CreateOrderModal.tsx` - Already exists, update to use new schema
- `AssignProductionModal.tsx` - NEW
- `AddPaymentModal.tsx` - NEW
- Order detail page - Update to show conditional buttons

---

## 📋 **Migration Steps**

1. ✅ Run `cleanup_and_enhance_quotes.sql`
2. ✅ Delete existing test order if any
3. ✅ Update API route `/api/orders` to work with quotes table
4. ✅ Update CreateOrderModal to generate order_number
5. ✅ Build /orders list page
6. ✅ Update detail page with conditional rendering
7. ✅ Build AssignProductionModal
8. ✅ Build AddPaymentModal

---

## ✅ **Summary**

**Before:**
- Complex orders table with duplicated data
- Separate order_payments table
- Confusing foreign keys
- Performance overhead from joins

**After:**
- Simple quotes table with order fields
- One table for everything
- Clear status-based filtering
- Fast, simple, maintainable

**Result:** Clean, performant, no duplication! 🎉


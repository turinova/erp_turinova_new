# Phase 4: Promotions & Volume Pricing - Implementation Plan

**Date:** 2025-03-20  
**Status:** Ready for Implementation  
**Priority:** High

---

## 📋 Executive Summary

Implement comprehensive promotions and volume pricing system using ShopRenter's `productSpecial` API. This enables time-based discounts, quantity-based pricing, customer-group-specific promotions, and "Product of the Day" features.

---

## ✅ ShopRenter API Verification

**Confirmed Features:**
- ✅ `productSpecial` - Full CRUD support (GET, POST, PUT, DELETE)
- ✅ Priority system - Integer values (higher = wins)
- ✅ Date-based promotions - `dateFrom` / `dateTo`
- ✅ Volume pricing - `minQuantity` / `maxQuantity`
- ✅ Customer group targeting - Optional `customerGroup` field
- ✅ Product of the day - `type: "day_spec"`, `priority: -1`, `dayOfWeek: 1-7`
- ✅ Limited discount - `isLimitedDiscount`, `maxOrderableCount` (implemented later)

**API Endpoints:**
- `GET /productSpecials` - List all (supports `productId` filter)
- `GET /productSpecials/{id}` - Get single
- `POST /productSpecials` - Create
- `PUT /productSpecials/{id}` - Update
- `DELETE /productSpecials/{id}` - Delete

---

## 🎯 Priority System Recommendation

**Recommendation: Auto-increment Priority**

For a future-proof, user-friendly ERP:
- **Default Priority:** Auto-increment from 1 (newest promotion gets highest priority)
- **Product of Day:** Always uses priority `-1` (as per ShopRenter spec)
- **User Override:** Allow manual priority setting for advanced users
- **Display:** Show priority in UI with explanation (higher = wins conflicts)

**Rationale:**
- Most users don't understand priority - auto-increment is intuitive
- New promotions automatically win conflicts (expected behavior)
- Advanced users can still set custom priority if needed
- Matches industry standard (newest = highest priority by default)

---

## 🗄️ Database Schema

### Table: `product_specials`

```sql
CREATE TABLE IF NOT EXISTS public.product_specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product reference
  product_id UUID NOT NULL REFERENCES public.shoprenter_products(id) ON DELETE CASCADE,
  
  -- ShopRenter sync
  shoprenter_special_id TEXT, -- ShopRenter resource ID (nullable until synced)
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- Customer group (nullable = "Everyone")
  customer_group_id UUID REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  
  -- Promotion details
  priority INTEGER NOT NULL DEFAULT 1, -- Higher priority wins conflicts
  price DECIMAL(15,4) NOT NULL, -- Special price (net)
  
  -- Date range
  date_from DATE, -- NULL = no start date
  date_to DATE, -- NULL = no end date
  
  -- Volume pricing
  min_quantity INTEGER DEFAULT 0, -- 0 = no minimum
  max_quantity INTEGER DEFAULT 0, -- 0 = unlimited
  
  -- Product of the day
  type TEXT DEFAULT 'interval', -- 'interval' or 'day_spec'
  day_of_week INTEGER, -- 1-7 (Monday-Sunday), only for type='day_spec'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_expired BOOLEAN DEFAULT false, -- Auto-set when date_to < today
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 1 AND day_of_week <= 7)),
  CONSTRAINT valid_priority CHECK (priority >= -1),
  CONSTRAINT valid_quantity_range CHECK (max_quantity = 0 OR max_quantity >= min_quantity),
  CONSTRAINT valid_date_range CHECK (date_to IS NULL OR date_from IS NULL OR date_to >= date_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_specials_product_id ON public.product_specials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_connection_id ON public.product_specials(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_customer_group_id ON public.product_specials(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_product_specials_active ON public.product_specials(is_active, is_expired) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_dates ON public.product_specials(date_from, date_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_specials_shoprenter_id ON public.product_specials(shoprenter_special_id) WHERE shoprenter_special_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.product_specials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product_specials for their tenant"
  ON public.product_specials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = product_specials.connection_id
      AND wc.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert product_specials for their tenant"
  ON public.product_specials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = product_specials.connection_id
      AND wc.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update product_specials for their tenant"
  ON public.product_specials FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = product_specials.connection_id
      AND wc.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete product_specials for their tenant"
  ON public.product_specials FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.webshop_connections wc
      WHERE wc.id = product_specials.connection_id
      AND wc.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_product_specials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_specials_updated_at
  BEFORE UPDATE ON public.product_specials
  FOR EACH ROW
  EXECUTE FUNCTION update_product_specials_updated_at();

-- Trigger to auto-set is_expired
CREATE OR REPLACE FUNCTION check_product_special_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_to IS NOT NULL AND NEW.date_to < CURRENT_DATE THEN
    NEW.is_expired = true;
  ELSE
    NEW.is_expired = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_specials_check_expiration
  BEFORE INSERT OR UPDATE ON public.product_specials
  FOR EACH ROW
  EXECUTE FUNCTION check_product_special_expiration();

-- Function to get next priority for a product
CREATE OR REPLACE FUNCTION get_next_priority_for_product(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_priority INTEGER;
BEGIN
  SELECT COALESCE(MAX(priority), 0) INTO max_priority
  FROM public.product_specials
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
    AND priority > 0; -- Don't count -1 (product of day)
  
  RETURN max_priority + 1;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔍 Edge Cases & Validation

### 1. **Date Range Validation**
- ✅ `date_to` must be >= `date_from` (database constraint)
- ✅ Warn if `date_from` is in the past (but allow for historical data)
- ✅ Warn if `date_to` is in the past (auto-set `is_expired = true`)
- ✅ Allow NULL dates (no start/end date = always active)

### 2. **Quantity Range Validation**
- ✅ `max_quantity` must be >= `min_quantity` (database constraint)
- ✅ `min_quantity = 0` means no minimum
- ✅ `max_quantity = 0` means unlimited
- ✅ Warn if quantity range overlaps with existing promotion

### 3. **Priority Conflicts**
- ✅ Detect overlapping promotions (same product, customer group, date range, quantity range)
- ✅ Warn user about conflicts
- ✅ Show which promotion will win (higher priority)
- ✅ Allow user to adjust priority

### 4. **Customer Group Handling**
- ✅ `customer_group_id = NULL` = "Everyone" (all customer groups)
- ✅ If changing from specific group to "Everyone", delete and recreate (ShopRenter requirement)
- ✅ Validate customer group exists and is synced to ShopRenter

### 5. **Product of the Day**
- ✅ `type = 'day_spec'` requires `priority = -1` (enforce in UI/API)
- ✅ `day_of_week` must be 1-7 (database constraint)
- ✅ Only one product of day per day of week per product (validate in application)
- ✅ `date_from` and `date_to` are optional for product of day

### 6. **ShopRenter Sync Edge Cases**
- ✅ Handle 409 conflicts (promotion already exists)
- ✅ Handle missing customer group in ShopRenter (create or skip)
- ✅ Handle missing product in ShopRenter (skip with warning)
- ✅ Store `shoprenter_special_id` for updates
- ✅ If `shoprenter_special_id` exists, use PUT; otherwise POST
- ✅ If sync fails, mark with error but don't delete from ERP

### 7. **Expiration Handling**
- ✅ Auto-set `is_expired = true` when `date_to < today` (trigger)
- ✅ Don't auto-delete expired promotions (mark inactive)
- ✅ Show expired promotions in UI with visual indicator
- ✅ Option to manually delete expired promotions

### 8. **Price Validation**
- ✅ Price must be > 0
- ✅ Price should be < regular price (warn if higher)
- ✅ Price format: net price (ShopRenter calculates gross)

### 9. **Volume Pricing Overlaps**
- ✅ Detect if quantity ranges overlap
- ✅ Example: Promotion A (10-50) and Promotion B (30-100) overlap
- ✅ Warn user and show which will apply based on priority

### 10. **Connection/Product Sync Status**
- ✅ Only allow promotions for products that are synced to ShopRenter
- ✅ Validate `connection_id` exists and is active
- ✅ Validate product has `shoprenter_id` (not pending)

---

## 🎨 UI Design (Matching Existing Cards)

### Card Style (Same as CustomerGroupPricingCard)
- **Border:** `2px solid` with color theme
- **Background:** `white`
- **Padding:** `p: 3`
- **Icon:** Circular icon with theme color
- **Typography:** Bold h6 for title
- **Compact:** Table with minimal padding (`py: 1`)

### Promotions Card on Product Page

**Location:** "Árazás" tab, after Customer Group Pricing card

**Structure:**
```
┌─────────────────────────────────────────────────┐
│ [🎁 Icon] Akciók & Mennyiségi Árazás           │
│                                                  │
│ [+ Új akció] button                             │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Aktív akciók (2)                            │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Vevőcsoport | Ár | Dátum | Mennyiség |  │ │ │
│ │ │ Asztalosok  |... | ...   | ...       |  │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Lejárt akciók (1)                           │ │
│ │ [Collapsed by default]                       │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Table Columns:**
- Vevőcsoport (Customer Group)
- Akciós ár (Nettó) (Special Price)
- Dátum (Date Range)
- Mennyiség (Quantity Range)
- Prioritás (Priority)
- Státusz (Status: Active/Expired)
- Műveletek (Actions: Edit/Delete)

---

## 📝 API Routes

### 1. `GET /api/products/[id]/promotions`
- List all promotions for a product
- Filter by active/expired
- Include customer group names

### 2. `POST /api/products/[id]/promotions`
- Create new promotion
- Auto-calculate priority if not provided
- Validate all edge cases
- Sync to ShopRenter

### 3. `PUT /api/products/[id]/promotions/[promotionId]`
- Update existing promotion
- Handle ShopRenter sync (PUT if ID exists)
- Handle customer group change to "Everyone" (delete + recreate)

### 4. `DELETE /api/products/[id]/promotions/[promotionId]`
- Soft delete (set `deleted_at`)
- Delete from ShopRenter
- Handle sync errors gracefully

### 5. `POST /api/products/[id]/promotions/[promotionId]/sync`
- Manual sync to ShopRenter
- Useful for retry after errors

---

## 🔄 ShopRenter Sync Logic

### Push (ERP → ShopRenter)

**Create/Update:**
```typescript
// Determine if create or update
if (promotion.shoprenter_special_id) {
  // Update existing
  PUT /productSpecials/{shoprenter_special_id}
} else {
  // Create new
  POST /productSpecials
}

// Payload structure
{
  priority: promotion.priority.toString(),
  price: promotion.price.toFixed(4),
  dateFrom: promotion.date_from || null,
  dateTo: promotion.date_to || null,
  minQuantity: promotion.min_quantity.toString(),
  maxQuantity: promotion.max_quantity.toString(),
  product: { id: product.shoprenter_id },
  customerGroup: promotion.customer_group_id 
    ? { id: customerGroup.shoprenter_customer_group_id }
    : null, // null = "Everyone"
  type: promotion.type === 'day_spec' ? 'day_spec' : undefined,
  dayOfWeek: promotion.type === 'day_spec' ? promotion.day_of_week.toString() : undefined
}
```

**Edge Cases:**
- If customer group changed to "Everyone", delete old and create new
- If product not synced, skip with warning
- If customer group not synced, create it first or skip with warning
- Handle 409 conflicts (promotion exists) - extract ID and update

### Pull (ShopRenter → ERP)

**During Product Sync:**
```typescript
// Fetch productSpecials for product
GET /productSpecials?productId={shoprenter_id}&full=1

// For each special:
// 1. Check if exists in ERP (by shoprenter_special_id)
// 2. If exists, update
// 3. If not, create new
// 4. Map customer group (create if needed)
```

---

## 🗂️ Permission System Integration

### New Page: `/promotions`

**Add to `tenant-database-template.sql`:**
```sql
-- Add promotions page
INSERT INTO public.pages (path, name, description, category, is_active)
VALUES (
  '/promotions',
  'Akciók',
  'Termék akciók és mennyiségi árazás kezelése',
  'Árszabás',
  true
)
ON CONFLICT (path) DO NOTHING;

-- Grant default permissions (same as other pricing pages)
INSERT INTO public.user_permissions (user_id, page_id, can_view, can_create, can_update, can_delete)
SELECT 
  u.id,
  (SELECT id FROM public.pages WHERE path = '/promotions'),
  true, true, true, true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up
  WHERE up.user_id = u.id
  AND up.page_id = (SELECT id FROM public.pages WHERE path = '/promotions')
);
```

---

## 📱 UI Components

### 1. `PromotionsCard.tsx` (Product Page)
- Similar to `CustomerGroupPricingCard.tsx`
- Compact table design
- Add/Edit/Delete buttons
- Status indicators (Active/Expired)
- Collapsible expired section

### 2. `PromotionDialog.tsx` (Create/Edit Modal)
- Form fields matching requirements
- Validation with helpful error messages
- Customer group dropdown (with "Everyone" option)
- Date pickers
- Quantity inputs
- Priority input (with auto-suggest)
- Type selector (Interval / Product of Day)
- Day of week selector (if type = day_spec)

### 3. `/promotions` Page (Future - Not in Phase 4)
- List all promotions
- Filtering
- Bulk actions
- (Deferred per user request)

---

## ✅ Implementation Checklist

### Phase 4.1: Database & API
- [ ] Create `product_specials` table migration
- [ ] Add to `tenant-database-template.sql`
- [ ] Create API routes (GET, POST, PUT, DELETE)
- [ ] Add validation logic for all edge cases
- [ ] Add priority auto-calculation function

### Phase 4.2: ShopRenter Integration
- [ ] Create sync functions in `shoprenter-api.ts`
- [ ] Implement push logic (ERP → ShopRenter)
- [ ] Implement pull logic (ShopRenter → ERP)
- [ ] Handle all edge cases (409, missing groups, etc.)
- [ ] Add sync to product sync route

### Phase 4.3: UI Components
- [ ] Create `PromotionsCard.tsx`
- [ ] Create `PromotionDialog.tsx`
- [ ] Integrate into ProductEditForm (Árazás tab)
- [ ] Match existing card styling
- [ ] Add status indicators
- [ ] Add validation messages

### Phase 4.4: Permissions & Menu
- [ ] Add `/promotions` page to permission system
- [ ] Add to vertical menu (under "Árszabás")
- [ ] Test permissions

### Phase 4.5: Testing
- [ ] Test create promotion
- [ ] Test edit promotion
- [ ] Test delete promotion
- [ ] Test date range validation
- [ ] Test quantity range validation
- [ ] Test priority conflicts
- [ ] Test customer group changes
- [ ] Test product of day
- [ ] Test sync to ShopRenter
- [ ] Test pull from ShopRenter
- [ ] Test expiration handling

---

## 🚫 Features NOT in Phase 4

- ❌ Bulk operations (per user request)
- ❌ Limited discount (`isLimitedDiscount`, `maxOrderableCount`) - deferred
- ❌ `/promotions` management page - deferred
- ❌ Auto-delete expired promotions - will mark inactive only

---

## 📊 Data Flow Example

### Creating a Promotion:
1. User fills form in `PromotionDialog`
2. Validation runs (dates, quantities, conflicts)
3. API calculates priority (if not provided)
4. API creates record in `product_specials`
5. API syncs to ShopRenter (POST /productSpecials)
6. API stores `shoprenter_special_id`
7. UI refreshes promotions list

### Updating a Promotion:
1. User edits in `PromotionDialog`
2. Validation runs
3. API updates record in `product_specials`
4. If customer group changed to "Everyone":
   - Delete old promotion in ShopRenter
   - Create new promotion in ShopRenter
5. Otherwise: API syncs to ShopRenter (PUT /productSpecials/{id})
6. UI refreshes

---

## 🎯 Success Criteria

- ✅ Users can create time-based promotions
- ✅ Users can create volume-based pricing
- ✅ Users can create customer-group-specific promotions
- ✅ Users can create "Product of the Day"
- ✅ All promotions sync to ShopRenter
- ✅ All edge cases handled gracefully
- ✅ UI matches existing card design
- ✅ No data loss during sync
- ✅ Clear error messages for users

---

## 📝 Notes

- Priority system: Auto-increment recommended for user-friendliness
- Expired promotions: Mark inactive, don't delete
- Customer group "Everyone": Requires delete + recreate in ShopRenter
- Product of Day: Uses priority -1, type 'day_spec'
- All validations must be user-friendly with clear messages

# Testing Guide: Promotions & Volume Pricing Feature

## Prerequisites

1. ✅ Database migrations run successfully
2. ✅ Permissions migration run successfully
3. ✅ At least one product synced to ShopRenter (has `shoprenter_id`)
4. ✅ At least one customer group created (optional, for customer group targeting)
5. ✅ ShopRenter connection configured and working

---

## 🧪 Test Scenarios

### 1. Basic Functionality Tests

#### Test 1.1: Create Time-Based Promotion
**Steps:**
1. Navigate to a product page: `/products/{product-id}`
2. Go to "Árazás" tab
3. Scroll to "Akciók & Mennyiségi Árazás" card
4. Click "Új akció" button
5. Fill in:
   - **Típus**: "Időszakos akció"
   - **Vevőcsoport**: Leave empty (or select one)
   - **Akciós ár (Nettó)**: `1000`
   - **Kezdő dátum**: Today's date
   - **Befejező dátum**: 7 days from now
   - **Minimum mennyiség**: `0`
   - **Maximum mennyiség**: `0` (unlimited)
   - **Prioritás**: Leave empty (should auto-calculate)
6. Click "Mentés"

**Expected Results:**
- ✅ Promotion created successfully
- ✅ Toast message: "Akció létrehozva"
- ✅ Promotion appears in "Aktív akciók" table
- ✅ Promotion synced to ShopRenter (check ShopRenter admin)
- ✅ Priority auto-calculated (should be 1 if first promotion)

**Verify in ShopRenter:**
- Go to ShopRenter admin → Products → Your product
- Check "Akciók" section
- Promotion should be visible with correct price and dates

---

#### Test 1.2: Create Volume Pricing Promotion
**Steps:**
1. Click "Új akció"
2. Fill in:
   - **Típus**: "Időszakos akció"
   - **Akciós ár (Nettó)**: `800`
   - **Kezdő dátum**: Today
   - **Befejező dátum**: 30 days from now
   - **Minimum mennyiség**: `10`
   - **Maximum mennyiség**: `50`
3. Click "Mentés"

**Expected Results:**
- ✅ Promotion created
- ✅ Shows in table with quantity range "10-50"
- ✅ Synced to ShopRenter with `minQuantity: 10`, `maxQuantity: 50`

---

#### Test 1.3: Create Product of the Day
**Steps:**
1. Click "Új akció"
2. Fill in:
   - **Típus**: "Nap terméke"
   - **Hét napja**: "Hétfő" (Monday = 1)
   - **Akciós ár (Nettó)**: `500`
   - **Prioritás**: Should be disabled and auto-set to -1
3. Click "Mentés"

**Expected Results:**
- ✅ Promotion created
- ✅ Type shows as "Nap terméke (Hétfő)" in table
- ✅ Priority is -1 (check in database if needed)
- ✅ Synced to ShopRenter with `type: "day_spec"`, `dayOfWeek: 1`, `priority: -1`

---

#### Test 1.4: Edit Promotion
**Steps:**
1. Find an existing promotion in the table
2. Click edit icon (pencil)
3. Change price from `1000` to `900`
4. Click "Mentés"

**Expected Results:**
- ✅ Promotion updated
- ✅ Toast: "Akció frissítve"
- ✅ New price shows in table
- ✅ Updated in ShopRenter

---

#### Test 1.5: Delete Promotion
**Steps:**
1. Find an active promotion
2. Click delete icon (trash)
3. Confirm deletion

**Expected Results:**
- ✅ Promotion removed from "Aktív akciók" table
- ✅ Toast: "Akció törölve"
- ✅ Deleted from ShopRenter
- ✅ Soft deleted in database (`deleted_at` set)

---

### 2. Edge Case Tests

#### Test 2.1: Date Range Validation
**Test Case A: End date before start date**
1. Create promotion with:
   - **Kezdő dátum**: 2025-03-25
   - **Befejező dátum**: 2025-03-20
2. Click "Mentés"

**Expected:** ❌ Error message: "End date must be after start date"

**Test Case B: No date range (always active)**
1. Create promotion with:
   - **Kezdő dátum**: Leave empty
   - **Befejező dátum**: Leave empty
2. Click "Mentés"

**Expected:** ✅ Promotion created, shows "Nincs korlát" for dates

**Test Case C: Past end date (auto-expiration)**
1. Create promotion with:
   - **Befejező dátum**: Yesterday's date
2. Click "Mentés"

**Expected:** ✅ Promotion created but `is_expired = true`, appears in "Lejárt akciók" section

---

#### Test 2.2: Quantity Range Validation
**Test Case A: Max < Min**
1. Create promotion with:
   - **Minimum mennyiség**: `50`
   - **Maximum mennyiség**: `10`
2. Click "Mentés"

**Expected:** ❌ Error: "Maximum quantity must be greater than or equal to minimum quantity"

**Test Case B: Negative quantities**
1. Create promotion with:
   - **Minimum mennyiség**: `-5`
2. Click "Mentés"

**Expected:** ❌ Error: "Quantity values cannot be negative"

**Test Case C: Unlimited quantity**
1. Create promotion with:
   - **Minimum mennyiség**: `0`
   - **Maximum mennyiség**: `0`
2. Click "Mentés"

**Expected:** ✅ Created, shows "Nincs korlát" in table

---

#### Test 2.3: Priority System
**Test Case A: Auto-increment priority**
1. Create first promotion (leave priority empty)
2. Create second promotion (leave priority empty)
3. Create third promotion (leave priority empty)

**Expected:**
- ✅ First promotion: priority = 1
- ✅ Second promotion: priority = 2
- ✅ Third promotion: priority = 3

**Test Case B: Manual priority override**
1. Create promotion with:
   - **Prioritás**: `5`
2. Click "Mentés"

**Expected:** ✅ Promotion created with priority = 5

**Test Case C: Product of Day priority**
1. Create "Nap terméke" promotion
2. Try to set priority manually

**Expected:** ✅ Priority field disabled, automatically set to -1

---

#### Test 2.4: Customer Group Handling
**Test Case A: "Everyone" (no customer group)**
1. Create promotion with:
   - **Vevőcsoport**: Leave empty (select "Mindenki")
2. Click "Mentés"

**Expected:** ✅ Created, shows "Mindenki" chip in table

**Test Case B: Specific customer group**
1. Create promotion with:
   - **Vevőcsoport**: Select an existing customer group
2. Click "Mentés"

**Expected:** ✅ Created, shows customer group name chip

**Test Case C: Change from specific group to "Everyone"**
1. Edit existing promotion with customer group
2. Change **Vevőcsoport** to "Mindenki" (empty)
3. Click "Mentés"

**Expected:** ✅ Updated, old promotion deleted in ShopRenter, new one created

---

#### Test 2.5: Overlapping Promotions (Conflict Detection)
**Test Case A: Date overlap warning**
1. Create promotion:
   - Dates: Today to +7 days
   - Customer group: "Mindenki"
2. Create second promotion:
   - Dates: +5 days to +15 days (overlaps!)
   - Customer group: "Mindenki"
   - Same quantity range

**Expected:** ⚠️ Warning toast: "Ez az akció átfedésben van más akciókkal. A magasabb prioritású nyer."
- ✅ Both promotions created
- ✅ Higher priority wins in ShopRenter

**Test Case B: Quantity range overlap**
1. Create promotion:
   - Quantity: 10-50
2. Create second promotion:
   - Quantity: 30-100 (overlaps 30-50!)

**Expected:** ⚠️ Warning if dates also overlap

---

#### Test 2.6: Price Validation
**Test Case A: Zero or negative price**
1. Create promotion with:
   - **Akciós ár**: `0` or `-100`
2. Click "Mentés"

**Expected:** ❌ Error: "Price is required and must be greater than 0"

**Test Case B: Very high price**
1. Create promotion with:
   - **Akciós ár**: `9999999`
2. Click "Mentés"

**Expected:** ✅ Created (no upper limit validation, but should warn if higher than regular price)

---

#### Test 2.7: Product of Day Validation
**Test Case A: Missing day of week**
1. Create promotion:
   - **Típus**: "Nap terméke"
   - **Hét napja**: Leave empty
2. Click "Mentés"

**Expected:** ❌ Error: "Day of week must be between 1 (Monday) and 7 (Sunday) for Product of the Day"

**Test Case B: All days of week**
1. Create 7 promotions, one for each day (Monday-Sunday)

**Expected:** ✅ All created successfully, each with different `day_of_week` (1-7)

---

#### Test 2.8: Expired Promotions
**Test Case A: Auto-expiration**
1. Create promotion with end date = yesterday
2. Check table

**Expected:** ✅ Promotion appears in "Lejárt akciók" section (collapsed by default)
- ✅ `is_expired = true` in database
- ✅ Can still be deleted

**Test Case B: Manual expiration toggle**
1. Edit active promotion
2. Set `is_active = false` (if field exists in UI, or via API)

**Expected:** ✅ Moved to expired section

---

### 3. ShopRenter Sync Tests

#### Test 3.1: Auto-Sync on Create
**Steps:**
1. Create a new promotion
2. Check ShopRenter admin immediately

**Expected:** ✅ Promotion appears in ShopRenter within seconds

**Verify:**
- Price matches
- Dates match
- Customer group matches (or null for "Everyone")
- Quantity ranges match
- Type matches (interval vs day_spec)

---

#### Test 3.2: Auto-Sync on Update
**Steps:**
1. Edit existing promotion
2. Change price
3. Save

**Expected:** ✅ Updated in ShopRenter immediately

---

#### Test 3.3: Auto-Sync on Delete
**Steps:**
1. Delete promotion from ERP
2. Check ShopRenter

**Expected:** ✅ Deleted from ShopRenter

---

#### Test 3.4: Sync Error Handling
**Test Case A: Product not synced to ShopRenter**
1. Find product without `shoprenter_id` (or with `pending-` prefix)
2. Try to create promotion

**Expected:** ❌ Error: "Product must be synced to ShopRenter before creating promotions"

**Test Case B: Customer group not synced**
1. Create promotion with customer group that doesn't have `shoprenter_customer_group_id`
2. Save

**Expected:** ⚠️ Warning in toast, promotion created locally but sync may fail

**Test Case C: ShopRenter API error (409 conflict)**
1. Create promotion that already exists in ShopRenter (same product, dates, customer group)
2. Save

**Expected:** ✅ System handles 409, extracts existing ID, updates instead of failing

---

### 4. UI/UX Tests

#### Test 4.1: Table Display
**Check:**
- ✅ Active promotions show in "Aktív akciók" section
- ✅ Expired promotions show in "Lejárt akciók" (collapsed by default)
- ✅ Table columns: Vevőcsoport, Akciós ár, Dátum, Mennyiség, Típus, Műveletek
- ✅ Price formatted correctly (e.g., "1 000 Ft")
- ✅ Dates formatted in Hungarian (e.g., "2025. 03. 20.")
- ✅ Quantity ranges show correctly ("10-50" or "10+" or "Nincs korlát")

---

#### Test 4.2: Dialog Form
**Check:**
- ✅ All fields visible and accessible
- ✅ Dropdowns don't take full screen (max height 300px)
- ✅ Date pickers work correctly
- ✅ Validation errors show clearly
- ✅ "Mentés" button disabled when required fields missing
- ✅ Loading state during save

---

#### Test 4.3: Status Indicators
**Check:**
- ✅ Active promotions: Normal display
- ✅ Expired promotions: Slightly faded (opacity 0.7)
- ✅ Product of Day: Special chip color/style

---

### 5. Database Tests

#### Test 5.1: Data Integrity
**Check in database:**
```sql
SELECT * FROM product_specials WHERE product_id = '{your-product-id}';
```

**Verify:**
- ✅ All fields saved correctly
- ✅ `deleted_at` is NULL for active promotions
- ✅ `is_expired` calculated correctly
- ✅ `shoprenter_special_id` populated after sync
- ✅ `priority` set correctly

---

#### Test 5.2: Soft Delete
**Steps:**
1. Delete a promotion
2. Check database:

```sql
SELECT * FROM product_specials WHERE id = '{deleted-promotion-id}';
```

**Expected:** ✅ `deleted_at` is set (not NULL)
- ✅ Promotion doesn't appear in UI
- ✅ Still exists in database (soft delete)

---

#### Test 5.3: Trigger Functions
**Test auto-expiration trigger:**
1. Create promotion with past end date
2. Check `is_expired` field

**Expected:** ✅ `is_expired = true` automatically

**Test updated_at trigger:**
1. Update a promotion
2. Check `updated_at` timestamp

**Expected:** ✅ `updated_at` updated to current time

---

### 6. Integration Tests

#### Test 6.1: Product Sync Includes Promotions
**Steps:**
1. Create promotion on product
2. Go to product sync page
3. Sync product to ShopRenter

**Expected:** ✅ Promotion included in sync (if pull logic implemented)

---

#### Test 6.2: Multiple Promotions on Same Product
**Steps:**
1. Create 5 different promotions on same product:
   - Different customer groups
   - Different date ranges
   - Different quantity ranges
   - Mix of interval and day_spec

**Expected:** ✅ All created successfully
- ✅ All visible in table
- ✅ All synced to ShopRenter
- ✅ Priority conflicts handled correctly

---

### 7. Error Recovery Tests

#### Test 7.1: Network Failure During Sync
**Steps:**
1. Disconnect internet
2. Create promotion
3. Reconnect internet

**Expected:** ⚠️ Warning toast about sync failure
- ✅ Promotion saved locally
- ✅ Can manually retry sync (if manual sync endpoint exists)

---

#### Test 7.2: Invalid ShopRenter Response
**Steps:**
1. Temporarily break ShopRenter connection (wrong credentials)
2. Try to create promotion

**Expected:** ⚠️ Warning about sync failure
- ✅ Promotion saved locally
- ✅ `shoprenter_special_id` remains NULL

---

## ✅ Test Checklist

### Basic Functionality
- [ ] Create time-based promotion
- [ ] Create volume pricing promotion
- [ ] Create Product of the Day
- [ ] Edit promotion
- [ ] Delete promotion
- [ ] View active promotions
- [ ] View expired promotions

### Edge Cases
- [ ] Date range validation (end < start)
- [ ] No date range (always active)
- [ ] Past end date (auto-expiration)
- [ ] Quantity range validation (max < min)
- [ ] Negative quantities
- [ ] Unlimited quantity (0-0)
- [ ] Auto-increment priority
- [ ] Manual priority override
- [ ] Product of Day priority (-1)
- [ ] Customer group "Everyone"
- [ ] Specific customer group
- [ ] Change customer group to "Everyone"
- [ ] Overlapping promotions warning
- [ ] Price validation (zero/negative)
- [ ] Product of Day day validation

### ShopRenter Sync
- [ ] Auto-sync on create
- [ ] Auto-sync on update
- [ ] Auto-sync on delete
- [ ] Product not synced error
- [ ] Customer group not synced warning
- [ ] 409 conflict handling

### UI/UX
- [ ] Table displays correctly
- [ ] Dialog form works
- [ ] Status indicators visible
- [ ] Loading states
- [ ] Error messages clear

### Database
- [ ] Data integrity
- [ ] Soft delete works
- [ ] Triggers fire correctly

### Integration
- [ ] Multiple promotions on same product
- [ ] Error recovery

---

## 🐛 Common Issues to Watch For

1. **Promotion not syncing to ShopRenter**
   - Check product has `shoprenter_id`
   - Check connection credentials
   - Check browser console for errors

2. **Priority not auto-calculating**
   - Check database function `get_next_priority_for_product()` exists
   - Check function returns correct value

3. **Expired promotions not showing in collapsed section**
   - Check `is_expired` is set correctly
   - Check trigger `product_specials_check_expiration` exists

4. **Customer group change not working**
   - Check if old promotion deleted from ShopRenter
   - Check if new promotion created

5. **Date formatting issues**
   - Check date format in table matches Hungarian locale

---

## 📝 Test Data Suggestions

**Create test promotions:**
1. **Active promotion**: Today to +7 days, price 1000, "Mindenki"
2. **Volume pricing**: 10-50 quantity, price 800
3. **Product of Day**: Monday, price 500
4. **Expired promotion**: Yesterday's date, price 1200
5. **Customer group specific**: Specific customer group, price 900
6. **No date range**: Always active, price 1100

---

## 🎯 Success Criteria

All tests should pass:
- ✅ No errors in browser console
- ✅ All promotions sync to ShopRenter
- ✅ All validations work correctly
- ✅ UI is responsive and user-friendly
- ✅ Database integrity maintained
- ✅ Edge cases handled gracefully

---

**Happy Testing! 🚀**

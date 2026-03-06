# Product Type Change & Attribute Management Plan

## Overview
When a product's type (termék típus / Product Class) is changed, the attributes must be cleared since different product types have different attributes. The attribute addition modal should only show attributes that belong to the selected product type.

## Current State Analysis

### Current Behavior
1. **Product Class Change** (`PUT /api/products/[id]/product-class`):
   - ✅ Updates Product Class in ShopRenter
   - ✅ Updates local database sync status to 'pending'
   - ❌ **Does NOT clear existing attributes** (BUG)
   - ✅ Reloads product after change

2. **Available Attributes** (`GET /api/products/[id]/attributes/available`):
   - ✅ Filters by current product's Product Class
   - ✅ Excludes already assigned attributes
   - ✅ Returns empty array if no Product Class assigned
   - ✅ Works correctly

3. **UI Flow**:
   - User selects new Product Class
   - Confirmation dialog appears
   - On confirm, Product Class is updated
   - Page refreshes
   - **Problem**: Old attributes still visible until next sync from ShopRenter

### ShopRenter API Behavior
According to ShopRenter documentation:
- When Product Class is changed via `PUT /productExtend/{id}`, ShopRenter automatically:
  - Removes all existing `productListAttributeValueRelations` for attributes not in the new Product Class
  - Keeps relations for attributes that exist in both old and new Product Class
  - The `productAttributeExtend` field reflects the new Product Class attributes after sync

## Root Cause
The local `product_attributes` JSONB field is not cleared when Product Class changes, causing:
- Old attributes to remain visible in UI
- Potential sync conflicts
- User confusion about which attributes are valid

## Edge Cases Identified

### Edge Case 1: Product Has No Product Class
- **Scenario**: Product without Product Class, user tries to add attributes
- **Current**: Returns empty array with message
- **Required**: Show message that Product Class must be assigned first
- **Action**: ✅ Already handled correctly

### Edge Case 2: Product Class Not in Database
- **Scenario**: Product Class exists in ShopRenter but not synced to database
- **Current**: Returns empty array with message
- **Required**: Should fetch from ShopRenter API as fallback OR prompt user to sync Product Classes
- **Action**: Add fallback to fetch from ShopRenter API

### Edge Case 3: Attributes Belong to Both Product Classes
- **Scenario**: Old and new Product Class share some attributes
- **ShopRenter Behavior**: Keeps shared attributes automatically
- **Our Behavior**: Should clear all and let user re-add (safer, clearer)
- **Action**: Clear all attributes regardless of overlap

### Edge Case 4: User Has Unsaved Attribute Changes
- **Scenario**: User edited attributes but didn't sync, then changes Product Class
- **Current**: Changes are lost silently
- **Required**: Warn user about unsaved changes
- **Action**: Check for pending changes before allowing Product Class change

### Edge Case 5: Product Class Change During Active Edit
- **Scenario**: User has attribute modal open, changes Product Class
- **Current**: Modal might show stale data
- **Required**: Close modals and refresh available attributes
- **Action**: Close all attribute modals on Product Class change

### Edge Case 6: Sync Status After Clearing
- **Scenario**: Product has pending sync, then Product Class changes
- **Current**: Sync status set to 'pending'
- **Required**: Ensure attributes are cleared before sync
- **Action**: Clear attributes immediately, not during sync

### Edge Case 7: Product Has Variants
- **Scenario**: Parent product with variants changes Product Class
- **ShopRenter Behavior**: Variants might inherit new Product Class or need manual update
- **Required**: Warn user about variant impact
- **Action**: Check for variants and show warning

### Edge Case 8: Attributes with Values Not in New Product Class
- **Scenario**: Old Product Class has attribute "Color" with value "Red", new Product Class doesn't have "Color"
- **ShopRenter Behavior**: Removes the relation automatically
- **Our Behavior**: Should clear it immediately
- **Action**: Clear all attributes (handled by clearing all)

## Implementation Plan

### Phase 1: Clear Attributes on Product Class Change (P0 - Critical)

#### Step 1.1: Update Product Class Change API
**File**: `src/app/api/products/[id]/product-class/route.ts`
**Location**: After ShopRenter update (around line 249)

**Action**: Clear `product_attributes` in local database after successful ShopRenter update

```typescript
// After successful ShopRenter update (line 249)
// Clear product attributes since Product Class changed
await supabase
  .from('shoprenter_products')
  .update({ 
    product_attributes: [], // Clear all attributes
    sync_status: 'pending',
    updated_at: new Date().toISOString()
  })
  .eq('id', id)
```

**Rationale**: 
- Different Product Classes have different attributes
- ShopRenter will remove invalid relations on next sync
- Clearing immediately prevents UI confusion
- User can re-add attributes from new Product Class

#### Step 1.2: Update Response Message
**File**: `src/app/api/products/[id]/product-class/route.ts`
**Location**: Response message (around line 284)

**Action**: Update message to inform user that attributes were cleared

```typescript
message: 'Termék típusa frissítve. A korábbi attribútumok törölve lettek, mivel az új termék típus más attribútumokat tartalmaz. A változások szinkronizálása szükséges.'
```

### Phase 2: Enhance UI Confirmation Dialog (P1 - High)

#### Step 2.1: Add Warning About Attribute Clearing
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: Product Class confirmation dialog (around line 955)

**Action**: Show warning that attributes will be cleared

**Current Code**:
```typescript
const handleConfirmProductClassChange = () => {
  const newProductClassName = availableProductClasses.find(pc => pc.id === selectedProductClassId)?.name || 'Ismeretlen'
  setProductClassToUpdate({ id: selectedProductClassId, name: newProductClassName })
  setProductClassConfirmOpen(true)
  setProductClassEditModalOpen(false)
}
```

**New Code**: Check for existing attributes and show count

```typescript
const handleConfirmProductClassChange = () => {
  const newProductClassName = availableProductClasses.find(pc => pc.id === selectedProductClassId)?.name || 'Ismeretlen'
  const attributeCount = attributes.length
  setProductClassToUpdate({ 
    id: selectedProductClassId, 
    name: newProductClassName,
    willClearAttributes: attributeCount > 0,
    attributeCount: attributeCount
  })
  setProductClassConfirmOpen(true)
  setProductClassEditModalOpen(false)
}
```

#### Step 2.2: Update Confirmation Dialog UI
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: Product Class confirmation dialog JSX

**Action**: Show warning message if attributes will be cleared

```typescript
<DialogContent>
  <DialogContentText>
    Biztosan meg szeretné változtatni a termék típusát?
    {productClassToUpdate?.willClearAttributes && (
      <Alert severity="warning" sx={{ mt: 2 }}>
        <strong>Figyelem:</strong> A termék típus megváltoztatása során az összes jelenlegi attribútum ({productClassToUpdate.attributeCount} db) törlődni fog, mivel az új termék típus más attribútumokat tartalmaz.
      </Alert>
    )}
  </DialogContentText>
</DialogContentText>
```

### Phase 3: Handle Unsaved Changes (P1 - High)

#### Step 3.1: Check for Pending Changes
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: Before opening Product Class change modal

**Action**: Check if product has pending sync (unsaved changes)

```typescript
const handleOpenProductClassEditModal = async () => {
  // Check if product has pending changes
  if (product.sync_status === 'pending') {
    const confirmed = window.confirm(
      'A terméknek vannak nem szinkronizált változásai. A termék típus megváltoztatása előtt ajánlott szinkronizálni. Folytatja?'
    )
    if (!confirmed) {
      return
    }
  }
  
  setProductClassEditModalOpen(true)
  // ... rest of the code
}
```

### Phase 4: Improve Available Attributes Endpoint (P2 - Medium)

#### Step 4.1: Add Fallback to ShopRenter API
**File**: `src/app/api/products/[id]/attributes/available/route.ts`
**Location**: When Product Class not found in database (around line 61)

**Action**: Fetch Product Class from ShopRenter API as fallback

```typescript
if (!productClass) {
  // Fallback: Try to fetch from ShopRenter API
  try {
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (shopName) {
      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        shopName,
        connection.username || '',
        connection.password || '',
        connection.api_url
      )
      
      const classUrl = `${apiBaseUrl}/productClasses/${product.product_class_shoprenter_id}?full=1`
      const classResponse = await fetch(classUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (classResponse.ok) {
        const classData = await classResponse.json()
        // Fetch attribute relations from ShopRenter API
        // This is more complex, so for now just return message
        return NextResponse.json({
          success: true,
          attributes: [],
          message: 'A termék típus nincs szinkronizálva az adatbázisban. Kérjük, szinkronizálja a termék típusokat először.'
        })
      }
    }
  } catch (error) {
    console.warn('[ATTRIBUTES] Failed to fetch Product Class from ShopRenter:', error)
  }
  
  return NextResponse.json({
    success: true,
    attributes: [],
    message: 'A termék típus nem található az adatbázisban'
  })
}
```

**Note**: Full implementation would require fetching attribute relations from ShopRenter API, which is complex. For now, prompt user to sync Product Classes.

### Phase 5: Clear Attributes in UI Immediately (P1 - High)

#### Step 5.1: Update Attributes State After Product Class Change
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: After successful Product Class change (around line 983)

**Action**: Clear attributes state immediately

```typescript
if (result.success) {
  setProductClass(result.productClass)
  setAttributes([]) // Clear attributes immediately
  toast.success(result.message || 'Termék típusa frissítve')
  setProductClassConfirmOpen(false)
  setProductClassToUpdate(null)
  // Reload product to get updated attributes
  router.refresh()
}
```

### Phase 6: Handle Variants Warning (P2 - Medium)

#### Step 6.1: Check for Variants Before Product Class Change
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: Before confirming Product Class change

**Action**: Check if product has variants and warn user

```typescript
const handleConfirmProductClassChange = async () => {
  // Check if product has variants
  if (variantData?.isParent && variantData.childCount > 0) {
    const confirmed = window.confirm(
      `Ez a termék ${variantData.childCount} variánst tartalmaz. A termék típus megváltoztatása csak ezt a terméket érinti, a variánsok termék típusa nem változik meg. Folytatja?`
    )
    if (!confirmed) {
      return
    }
  }
  
  // ... rest of confirmation logic
}
```

### Phase 7: Close Modals on Product Class Change (P2 - Medium)

#### Step 7.1: Close All Attribute Modals
**File**: `src/app/(dashboard)/products/[id]/ProductEditForm.tsx`
**Location**: After successful Product Class change

**Action**: Close all open modals

```typescript
if (result.success) {
  setProductClass(result.productClass)
  setAttributes([])
  // Close all modals
  setAddAttributeModalOpen(false)
  setEditAttributeModalOpen(false)
  setDeleteAttributeModalOpen(false)
  setProductClassConfirmOpen(false)
  setProductClassToUpdate(null)
  // Clear selections
  setSelectedAttributeToAdd('')
  setNewAttributeValue(null)
  setNewListAttributeValues([])
  toast.success(result.message || 'Termék típusa frissítve')
  router.refresh()
}
```

## User Experience Flow

### Current Flow (Broken)
1. User changes Product Class
2. Confirmation dialog appears
3. User confirms
4. Product Class updated in ShopRenter
5. Page refreshes
6. ❌ Old attributes still visible
7. User confused

### New Flow (Fixed)
1. User changes Product Class
2. Confirmation dialog appears with warning about attribute clearing
3. User confirms
4. Product Class updated in ShopRenter
5. ✅ Attributes cleared in local database
6. ✅ Attributes cleared in UI immediately
7. ✅ All modals closed
8. Page refreshes
9. User can add new attributes from new Product Class

## Industry Standards & Best Practices

### 1. **Data Consistency**
- ✅ Clear invalid data immediately when structure changes
- ✅ Prevent orphaned/invalid data
- ✅ Maintain referential integrity

### 2. **User Feedback**
- ✅ Clear warnings before destructive actions
- ✅ Show what will be affected
- ✅ Confirm before proceeding

### 3. **Error Prevention**
- ✅ Validate before allowing changes
- ✅ Check for dependencies (variants)
- ✅ Handle edge cases gracefully

### 4. **ShopRenter Alignment**
- ✅ Follow ShopRenter's behavior (clears invalid relations)
- ✅ Sync status management
- ✅ API consistency

## Testing Plan

### Test Case 1: Basic Product Class Change
- Product with 3 attributes
- Change Product Class
- Verify attributes cleared
- Verify can add new attributes

### Test Case 2: Product Without Product Class
- Product without Product Class
- Try to add attribute
- Verify message shown

### Test Case 3: Product Class Not in Database
- Product with Product Class not synced
- Try to add attribute
- Verify fallback message

### Test Case 4: Product with Variants
- Parent product with variants
- Change Product Class
- Verify warning shown
- Verify only parent affected

### Test Case 5: Unsaved Changes
- Edit attribute (don't sync)
- Change Product Class
- Verify warning shown
- Verify changes lost

### Test Case 6: Attributes in Both Classes
- Product Class A has "Color" and "Size"
- Product Class B has "Color" and "Material"
- Change from A to B
- Verify all attributes cleared (including "Color")
- Verify can add "Color" from new class

### Test Case 7: Modal States
- Open add attribute modal
- Change Product Class
- Verify modal closed
- Verify can open modal again with new attributes

## Implementation Priority

1. **Phase 1** (P0) - Clear attributes on change (CRITICAL)
2. **Phase 2** (P1) - Warning in confirmation dialog (HIGH)
3. **Phase 5** (P1) - Clear attributes in UI immediately (HIGH)
4. **Phase 3** (P1) - Handle unsaved changes (HIGH)
5. **Phase 7** (P2) - Close modals (MEDIUM)
6. **Phase 6** (P2) - Variants warning (MEDIUM)
7. **Phase 4** (P2) - Fallback to ShopRenter API (MEDIUM)

## Success Criteria

- ✅ Attributes cleared when Product Class changes
- ✅ User warned before clearing
- ✅ UI updates immediately
- ✅ Only valid attributes shown in add modal
- ✅ Clear error messages for edge cases
- ✅ No data inconsistencies
- ✅ Aligned with ShopRenter behavior

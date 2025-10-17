# Edge Materials Gross Price Export/Import Implementation

**Date**: January 28, 2025  
**Feature**: Edge Materials Export/Import with Gross Price Support  
**Status**: ✅ Completed

## Overview

Updated the edge materials export/import functionality to handle gross prices instead of net prices, making it consistent with the rest of the application's pricing approach.

## Changes Made

### 1. Export API Updates (`/api/edge-materials/export/route.ts`)

**Before**:
- Exported net prices directly from database
- Column name: `"Ár (Ft)"`

**After**:
- Calculates gross prices from net prices using VAT rates
- Column name: `"Bruttó ár (Ft)"`
- Uses `Math.round()` for integer precision

```typescript
// Calculate gross price from net price
const vatRate = em.vat?.kulcs || 0
const grossPrice = Math.round(em.price * (1 + vatRate / 100))

return {
  // ... other fields
  'Bruttó ár (Ft)': grossPrice,
  // ... other fields
}
```

### 2. Import API Updates (`/api/edge-materials/import/route.ts`)

**Before**:
- Treated imported prices as net prices
- Direct database storage

**After**:
- Treats imported prices as gross prices
- Converts to net prices before database storage
- Supports both old and new column names

```typescript
// Get VAT rate for gross to net conversion
const vatRate = vatRates?.find(v => v.id === vatId)?.kulcs || 0

// Parse gross price and convert to net price
const grossPrice = parseFloat(row['Bruttó ár (Ft)']) || parseFloat(row['Ár (Ft)']) || 0
const netPrice = Math.round(grossPrice / (1 + vatRate / 100))
```

### 3. Import Preview API Updates (`/api/edge-materials/import/preview/route.ts`)

**Before**:
- Validated `"Ár (Ft)"` column
- Showed net prices in preview

**After**:
- Validates `"Bruttó ár (Ft)"` column (with backward compatibility)
- Shows gross prices in preview
- Updated error messages

```typescript
// Validate required fields
const requiredFields = {
  // ... other fields
  'Bruttó ár (Ft)': row['Bruttó ár (Ft)'] || row['Ár (Ft)'], // Support both old and new column names
  // ... other fields
}

// Get gross price (support both old and new column names)
const grossPrice = row['Bruttó ár (Ft)'] || row['Ár (Ft)'] || 0
```

### 4. Client UI Updates (`EdgeMaterialsListClient.tsx`)

**Before**:
- Import preview showed `"Ár"` column header

**After**:
- Import preview shows `"Bruttó ár"` column header

## Technical Benefits

### 1. Consistent Data Flow
- **Export**: Net prices → Gross prices (for user editing)
- **Import**: Gross prices → Net prices (for database storage)
- **Display**: Always shows gross prices in UI

### 2. Integer Precision
- Uses `Math.round()` to avoid floating-point precision issues
- Maintains integer-only pricing as requested

### 3. Backward Compatibility
- Supports both old (`"Ár (Ft)"`) and new (`"Bruttó ár (Ft)"`) Excel column names
- Smooth migration path for existing files

### 4. User Experience
- Users can now edit gross prices directly in Excel
- No need to manually calculate VAT
- Consistent with the rest of the application's gross price approach

## File Changes

### Modified Files:
1. `src/app/api/edge-materials/export/route.ts`
2. `src/app/api/edge-materials/import/route.ts`
3. `src/app/api/edge-materials/import/preview/route.ts`
4. `src/app/(dashboard)/edge/EdgeMaterialsListClient.tsx`

### Key Functions Updated:
- Export data transformation
- Import price conversion (gross → net)
- Import validation logic
- Import preview display

## Testing

### Export Test:
1. Go to `/edge` page
2. Click "Export" button
3. Verify Excel file has `"Bruttó ár (Ft)"` column
4. Verify prices are gross prices (higher than net prices)

### Import Test:
1. Import the exported Excel file
2. Verify no validation errors
3. Verify prices are correctly converted and stored as net prices
4. Verify UI displays gross prices

### Backward Compatibility Test:
1. Import old Excel file with `"Ár (Ft)"` column
2. Verify import works without errors
3. Verify prices are treated as gross and converted to net

## Migration Notes

### For Users:
- Existing Excel files with `"Ár (Ft)"` column will still work
- New exports will use `"Bruttó ár (Ft)"` column
- No action required for existing data

### For Developers:
- All price calculations now assume gross prices in Excel
- Database still stores net prices
- UI consistently shows gross prices

## Related Features

This implementation is consistent with:
- Edge material edit forms (gross price input)
- Edge material new forms (gross price input)
- Edge material list display (gross price display)
- Fee types gross price handling
- Opti settings gross price handling

## Future Considerations

- Consider adding column name detection to automatically handle different Excel formats
- Consider adding validation for price ranges
- Consider adding bulk price update functionality

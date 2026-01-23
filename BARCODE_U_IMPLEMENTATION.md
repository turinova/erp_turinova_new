# Barcode U Implementation Summary

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260122_add_barcode_u_column.sql`

- Added `barcode_u` column (VARCHAR(64), nullable)
- Created index `idx_accessories_barcode_u_active` for performance
- Added database comments for documentation

**⚠️ ACTION REQUIRED:** Run this migration manually in Supabase SQL Editor:
```sql
-- Add barcode_u column (internal barcode for generated codes)
ALTER TABLE public.accessories 
ADD COLUMN IF NOT EXISTS barcode_u character varying(64);

-- Create index for barcode_u (similar to barcode index)
CREATE INDEX IF NOT EXISTS idx_accessories_barcode_u_active 
ON public.accessories USING btree (barcode_u) 
WHERE (deleted_at IS NULL AND barcode_u IS NOT NULL);

-- Add comment
COMMENT ON COLUMN public.accessories.barcode_u IS 'Internal barcode (generated EAN-13 codes)';
COMMENT ON COLUMN public.accessories.barcode IS 'Manufacturer barcode (Gyártói vonalkód)';
```

### 2. Frontend Changes

#### AccessoryFormClient.tsx
- ✅ Updated `AccessoryFormData` interface to include `barcode_u?: string | null`
- ✅ Added `barcode_u: null` to initial form state
- ✅ Renamed "Vonalkód" label to "Gyártói vonalkód"
- ✅ Removed barcode generator button from "Gyártói vonalkód" field
- ✅ Added new "Belső vonalkód" field with generator button
- ✅ Updated `handleGenerateBarcode()` to set `barcode_u` instead of `barcode`
- ✅ Both fields use `normalizeBarcode()` for scanner input

#### Layout
- **Gyártói vonalkód:** Row 2, Column 2 (right side, below SKU)
- **Belső vonalkód:** Row 3, Column 1 (left side, below Gyártói vonalkód)
- Both fields are `xs={12} md={6}` (full width on mobile, half on desktop)

### 3. Backend API Changes

#### GET /api/accessories/[id]
- ✅ Added `barcode_u` to SELECT query
- ✅ Returns `barcode_u` in response

#### PUT /api/accessories/[id]
- ✅ Added `barcode_u` to request body destructuring
- ✅ Added `barcode_u` to UPDATE statement (trims and nullifies empty strings)
- ✅ Added `barcode_u` to SELECT query in response

#### POST /api/accessories (Create)
- ✅ Added `barcode_u` to request body destructuring
- ✅ Added `barcode_u` to INSERT statement

#### getAccessoryById() (supabase-server.ts)
- ✅ Added `barcode_u` to SELECT query
- ✅ Returns `barcode_u` in transformed data

#### [id]/page.tsx (Server Component)
- ✅ Updated `AccessoryFormData` interface to include `barcode_u`
- ✅ Added `barcode_u: accessory.barcode_u || null` to formData

## Field Behavior

### Gyártói vonalkód (Manufacturer Barcode)
- **Label:** "Gyártói vonalkód"
- **Helper Text:** "Opcionális"
- **Generator Button:** ❌ Removed
- **Normalization:** ✅ Yes (keyboard layout fixes)
- **Purpose:** Store manufacturer-provided barcodes

### Belső vonalkód (Internal Barcode)
- **Label:** "Belső vonalkód"
- **Helper Text:** "Opcionális - generált EAN-13 kód"
- **Generator Button:** ✅ Yes (only when field is empty)
- **Normalization:** ✅ Yes (keyboard layout fixes)
- **Purpose:** Store internally generated EAN-13 barcodes

## Testing Checklist

- [ ] Run database migration
- [ ] Test creating new accessory with both barcodes
- [ ] Test editing existing accessory - update both barcodes
- [ ] Test barcode generator button (should only appear when `barcode_u` is empty)
- [ ] Test normalization (scanner input with Hungarian keyboard)
- [ ] Verify both fields are optional (can save without them)
- [ ] Check that existing accessories load correctly (barcode_u should be null)

## Notes

- Both fields are optional (nullable in database)
- Both fields use the same normalization function for scanner compatibility
- The generator only creates EAN-13 format (13 digits with check digit)
- No uniqueness constraints added (as per current barcode field)
- Index created for performance (similar to barcode index)

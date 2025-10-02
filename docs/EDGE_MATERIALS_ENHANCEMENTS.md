# Edge Materials Enhancements

## Date: October 2, 2025

## Overview
This document details the comprehensive enhancements made to the Edge Materials (Élzárók) system, including new fields, export/import functionality, improved UI structure, and SSR implementation.

---

## Changes Summary

### 1. New Database Fields
- **`active`** (boolean): Indicates if the edge material is active for optimization
- **`ráhagyás`** (integer): Overhang/allowance in millimeters for optimization calculations
- **`machine_code`**: Stored in `machine_edge_material_map` table, similar to materials

### 2. Export/Import Functionality
- Excel-based export of all edge materials
- Excel-based import with preview and validation
- Machine code (`gépkód`) used as unique identifier for updates

### 3. UI Restructuring
- Edit and New pages now have identical structure
- Card-based separators matching materials page design
- Proper field widths and spacing

### 4. SSR Implementation
- New edge material page converted from client-only to SSR
- All data fetched on server before rendering
- Prevents hydration mismatches

---

## Database Changes

### SQL Migration: `add_active_and_rahagyas_to_edge_materials.sql`

```sql
-- Add 'active' column to edge_materials table
ALTER TABLE public.edge_materials
ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

-- Set existing edge materials to active
UPDATE public.edge_materials
SET active = TRUE
WHERE active IS NULL;

-- Add 'ráhagyás' column to edge_materials table
ALTER TABLE public.edge_materials
ADD COLUMN ráhagyás INTEGER NOT NULL DEFAULT 0;

-- Set existing edge materials' ráhagyás to 0
UPDATE public.edge_materials
SET ráhagyás = 0
WHERE ráhagyás IS NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_edge_materials_active ON public.edge_materials (active)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_edge_materials_rahagyas ON public.edge_materials (ráhagyás)
WHERE deleted_at IS NULL;
```

### Machine Code Integration
- Uses existing `machine_edge_material_map` table
- `machine_type` defaults to 'Korpus'
- Supports upsert operations for machine codes

---

## File Changes

### 1. Server-Side Data Fetching (`src/lib/supabase-server.ts`)

#### `getEdgeMaterialById`
**Added fields:**
```typescript
- active: boolean
- ráhagyás: number
- machine_code: string (from machine_edge_material_map)
```

**Implementation:**
```typescript
const { data: machineCode } = await supabaseServer
  .from('machine_edge_material_map')
  .select('machine_code')
  .eq('edge_material_id', id)
  .eq('machine_type', 'Korpus')
  .single()

return {
  ...edgeMaterial,
  active: edgeMaterial.active !== undefined ? edgeMaterial.active : true,
  ráhagyás: edgeMaterial.ráhagyás !== undefined ? edgeMaterial.ráhagyás : 0,
  machine_code: machineCode?.machine_code || ''
}
```

#### `getAllEdgeMaterials`
**Added fields to select query:**
```typescript
active, ráhagyás
```

---

### 2. API Routes

#### `src/app/api/edge-materials/[id]/route.ts`

**GET Request:**
- Added `active` and `ráhagyás` to select query
- Fetches `machine_code` from `machine_edge_material_map`

**PATCH Request:**
- Updates `active` and `ráhagyás` in edge_materials table
- Upserts `machine_code` in machine_edge_material_map:
  ```typescript
  if (body.machine_code !== undefined) {
    const { data: existing } = await supabaseServer
      .from('machine_edge_material_map')
      .select('id')
      .eq('edge_material_id', id)
      .eq('machine_type', 'Korpus')
      .single()

    if (existing) {
      await supabaseServer.from('machine_edge_material_map')
        .update({ machine_code: body.machine_code })
        .eq('edge_material_id', id)
        .eq('machine_type', 'Korpus')
    } else {
      await supabaseServer.from('machine_edge_material_map')
        .insert({ 
          edge_material_id: id, 
          machine_type: 'Korpus', 
          machine_code: body.machine_code 
        })
    }
  }
  ```

#### `src/app/api/edge-materials/route.ts`

**GET Request:**
- Added `active` and `ráhagyás` to select query

**POST Request:**
- Added `active` and `ráhagyás` to new edge material creation
- Inserts `machine_code` into `machine_edge_material_map` after creation

#### `src/app/api/edge-materials/export/route.ts` (NEW)
**Purpose:** Export all edge materials to Excel

**Fields Exported:**
1. Gépkód (from machine_edge_material_map)
2. Márka
3. Típus
4. Dekor
5. Szélesség (mm)
6. Vastagság (mm)
7. Ár (Ft)
8. Adónem (with percentage)
9. Ráhagyás (mm)
10. Aktív (Igen/Nem)

**Key Implementation:**
```typescript
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// Fetches edge materials with brands and VAT
// Fetches machine codes separately
// Creates Excel file with formatted data
// Returns as downloadable .xlsx file
```

#### `src/app/api/edge-materials/import/preview/route.ts` (NEW)
**Purpose:** Preview Excel import before execution

**Validation:**
- All required fields must be present
- Aktív must be "Igen" or "Nem"
- Machine code used to determine CREATE vs UPDATE action

**Returns:**
```typescript
{
  success: boolean
  preview: Array<{
    row: number
    action: 'Új' | 'Frissítés'
    machineCode: string
    brand: string
    type: string
    decor: string
    width: number
    thickness: number
    price: number
    vat: string
    ráhagyás: number
    active: boolean
  }>
  errors: string[]
}
```

#### `src/app/api/edge-materials/import/route.ts` (NEW)
**Purpose:** Execute Excel import

**Process:**
1. Parse Excel file
2. For each row:
   - Get or create brand (auto-create if doesn't exist)
   - Validate VAT exists
   - Check if machine code exists
   - If exists: UPDATE edge material + UPDATE machine_code
   - If new: INSERT edge material + INSERT machine_code
3. Return statistics: created count, updated count, errors

**Key Features:**
- Transaction-like behavior (rollback on machine_code insert failure)
- Auto-creates brands that don't exist
- Validates all required fields

---

### 3. Page Components

#### `src/app/(dashboard)/edge/[id]/page.tsx`
**Type:** Server Component (SSR)

**Changes:**
- Updated EdgeMaterial interface to include `active`, `ráhagyás`, `machine_code`
- Passes `initialMachineCode` to client component

#### `src/app/(dashboard)/edge/[id]/EdgeMaterialEditClient.tsx`
**Type:** Client Component

**Structure (Card-based):**

1. **Alap adatok** Card
   - Márka (md={2.4})
   - Típus (md={2.4})
   - Dekor (md={2.4})
   - Szélesség (md={2.4})
   - Vastagság (md={2.4})
   - Aktív switcher (md={2.4})

2. **Árazási adatok** Card
   - Ár (Ft) (md={2.4})
   - Adónem (md={2.4})

3. **Optimalizálási beállítások** Card
   - Ráhagyás (mm) (sm={6})

4. **Export beállítások** Card
   - Gép típus (sm={6}, disabled, "Korpus")
   - Gépkód (sm={6}, **required**)

5. **Metaadatok** Card (Edit only)
   - Létrehozva (md={4})
   - Utoljára módosítva (md={4})
   - Élzáró ID (md={4})

**Validation:**
- All fields except machine_code were already required
- **Machine code now required** (validation added)

#### `src/app/(dashboard)/edge/new/page.tsx`
**Type:** Server Component (SSR) - **CONVERTED FROM CLIENT**

**Changes:**
- Now fetches brands and VAT rates on server
- Finds 27% VAT as default
- Passes data to NewEdgeMaterialClient

**Implementation:**
```typescript
export default async function NewEdgeMaterialPage() {
  const brands = await getAllBrandsForEdgeMaterials()
  const vatRates = await getAllVatRatesForEdgeMaterials()
  
  const vat27 = vatRates.find(v => v.kulcs === 27)
  const defaultVatId = vat27 ? vat27.id : (vatRates.length > 0 ? vatRates[0].id : '')

  return (
    <NewEdgeMaterialClient 
      brands={brands} 
      vatRates={vatRates} 
      defaultVatId={defaultVatId}
    />
  )
}
```

#### `src/app/(dashboard)/edge/new/NewEdgeMaterialClient.tsx` (NEW)
**Type:** Client Component

**Structure:**
- Identical to Edit page (minus Metaadatok section)
- Default values:
  - `active: true`
  - `ráhagyás: 0`
  - `vat_id: 27% VAT` (passed from server)

**Validation:**
- All fields required including machine_code

#### `src/app/(dashboard)/edge/EdgeMaterialsListClient.tsx`
**Type:** Client Component

**New Features:**

1. **Export/Import Buttons** (Left side)
   ```tsx
   <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport}>
     Export
   </Button>
   <Button 
     variant="outlined" 
     component="label"
     startIcon={isImporting ? <CircularProgress size={20} /> : <ImportIcon />}
     disabled={isImporting}
   >
     Import
     <input type="file" hidden accept=".xlsx,.xls" onChange={handleImportFileSelect} />
   </Button>
   ```

2. **Import Flow:**
   - Click Import → File browser opens immediately
   - Select file → Auto-preview in modal
   - Review → Confirm import
   - Success → Refresh list

3. **Import Preview Modal:**
   - Shows statistics (total, new, updates)
   - Preview table with all fields
   - Color-coded action chips (green for new, blue for update)

4. **New Table Column:**
   - Added "Aktív" column showing "Igen" (green, bold) or "Nem" (red, bold)

---

## Default Values

### New Edge Materials
- `active`: `true`
- `ráhagyás`: `0`
- `vat_id`: 27% VAT (auto-selected from server)
- `machine_code`: Empty (user must provide)

### Existing Edge Materials
After running migration SQL:
- `active`: `TRUE` for all existing records
- `ráhagyás`: `0` for all existing records

---

## Import/Export Specifications

### Export Format (XLSX)
**Columns (in order):**
1. Gépkód
2. Márka
3. Típus
4. Dekor
5. Szélesség (mm)
6. Vastagság (mm)
7. Ár (Ft)
8. Adónem (format: "Név (XX%)")
9. Ráhagyás (mm)
10. Aktív (Igen/Nem)

### Import Matching Logic
- **Unique Identifier:** `Gépkód` (machine_code)
- If `Gépkód` exists in system → **UPDATE** edge material
- If `Gépkód` is new → **CREATE** new edge material
- Brand auto-creation: If brand doesn't exist, creates it automatically

### Import Validation
**Required Fields:**
- Gépkód
- Márka
- Típus
- Dekor
- Szélesség (mm)
- Vastagság (mm)
- Ár (Ft)
- Adónem
- Aktív

**Validation Rules:**
- All required fields must have values
- Aktív must be exactly "Igen" or "Nem"
- Adónem must match existing VAT rate format
- Numeric fields must be valid numbers
- If ANY row fails validation, ENTIRE import is rejected

---

## UI/UX Improvements

### Page Structure Consistency
Both Edit and New pages now use identical Card-based structure:
- Visual separation between sections
- Consistent field widths
- Better visual hierarchy
- Matches materials page design

### Field Width Standards
- **Alap adatok fields:** `md={2.4}` (5 fields per row)
- **Árazási adatok fields:** `md={2.4}`
- **Optimalizálási beállítások:** `sm={6}` (50% width)
- **Export beállítások:** `sm={6}` each (50% width)
- **Metaadatok:** `md={4}` each (3 fields per row)

### Card Spacing
- Grid container: `spacing={3}` for main sections
- Grid container inside cards: `spacing={2}` for Optimalizálási and Export sections
- Section margin bottom: `sx={{ mb: 4 }}`

---

## Technical Implementation

### SSR Architecture

#### Server Component (`page.tsx`)
```typescript
// Fetches data on server
const brands = await getAllBrandsForEdgeMaterials()
const vatRates = await getAllVatRatesForEdgeMaterials()
const edgeMaterial = await getEdgeMaterialById(id) // Edit only

// Passes to client component
<EdgeMaterialEditClient 
  initialEdgeMaterial={edgeMaterial}
  allBrands={brands}
  allVatRates={vatRates}
  initialMachineCode={machineCode}
/>
```

#### Client Component
```typescript
'use client'
// Uses props from server
// Handles user interactions
// No data fetching on mount (prevents hydration issues)
```

### API Route Pattern
**All import/export routes use `supabaseServer`:**
```typescript
import { supabaseServer } from '@/lib/supabase-server'

// NOT: import { createClient } from '@/lib/supabase-server'
// createClient() is only for server components, not API routes
```

---

## Optimization Integration

### Active Status Filtering
Edge materials with `active: false` are excluded from optimization dropdowns:

```typescript
// In OptiClient.tsx (future implementation)
const activeEdgeMaterials = edgeMaterials.filter(em => em.active !== false)
```

### Ráhagyás (Overhang) Usage
The `ráhagyás` field specifies the overhang in millimeters for edge material calculations during optimization. Default: 0 mm.

---

## User Workflow

### Creating a New Edge Material
1. Navigate to `/edge`
2. Click "Új élzáró hozzáadása"
3. Fill in all required fields:
   - Alap adatok: Márka, Típus, Dekor, Szélesség, Vastagság
   - Aktív switcher (defaults to ON)
   - Árazási adatok: Ár, Adónem (defaults to 27%)
   - Optimalizálási beállítások: Ráhagyás (defaults to 0)
   - Export beállítások: Gépkód (required)
4. Click "Mentés"
5. Redirected to edge materials list

### Editing an Edge Material
1. Navigate to `/edge`
2. Click on any edge material row
3. Modify fields as needed
4. Click "Mentés" (top-right)
5. Data saved and cache invalidated

### Exporting Edge Materials
1. Navigate to `/edge`
2. Click "Export" button (left side)
3. Excel file downloads automatically
4. Filename format: `elzarok_YYYY-MM-DD.xlsx`

### Importing Edge Materials
1. Navigate to `/edge`
2. Click "Import" button (left side)
3. File browser opens immediately
4. Select Excel file (.xlsx or .xls)
5. Preview modal shows:
   - Statistics (total, new, updates)
   - Complete preview table with all changes
   - Action column (green for new, blue for updates)
6. Review changes
7. Click "Import megerősítése"
8. Import executes and list refreshes
9. Success message shows counts

---

## Error Handling

### Validation Errors (Import)
- Shown in toast notification with 10s timeout
- Lists all validation errors
- Entire import rejected if any errors found

### Import Errors
- Row-level errors collected
- Import continues for valid rows
- Final report shows: X created, Y updated, Z errors

### Export Errors
- Detailed error messages in toast
- Server-side errors logged to console
- User-friendly error display

---

## Performance Considerations

### Database Indexes
Created for faster filtering:
```sql
idx_edge_materials_active
idx_edge_materials_rahagyas
```

### SSR Benefits
- Initial page load shows data immediately
- No loading spinners on page mount
- Better SEO (though internal ERP app)
- Prevents hydration mismatches

### Export Performance
- Fetches all data in 2 queries
- Minimal transformations
- Efficient XLSX generation

---

## Testing Checklist

### Edge Material Creation
- [x] New page loads with correct defaults
- [x] 27% VAT pre-selected
- [x] Active switcher defaults to ON
- [x] Ráhagyás defaults to 0
- [x] Machine code validation works
- [x] Saves successfully
- [x] Redirects to list page

### Edge Material Editing
- [x] Edit page loads with correct data
- [x] All fields editable
- [x] Active switcher works
- [x] Machine code editable and required
- [x] Saves successfully
- [x] Cache invalidates

### Export Functionality
- [x] Export button works
- [x] Excel file downloads
- [x] All fields included
- [x] Machine codes included
- [x] Formatting correct

### Import Functionality
- [x] Import button opens file browser immediately
- [x] File validation works
- [x] Preview shows correct actions (Új/Frissítés)
- [x] Statistics displayed correctly
- [x] Import executes successfully
- [x] List refreshes after import
- [x] Machine codes matched correctly
- [x] New brands auto-created

### List Page
- [x] Active column displays correctly
- [x] Export/Import buttons positioned correctly
- [x] All existing functionality still works

---

## Future Enhancements

### Potential Features
1. Filter by active status on list page
2. Bulk activate/deactivate selected edge materials
3. Export only selected edge materials
4. Import validation warnings (non-blocking)
5. Price history for edge materials (similar to materials)
6. Multiple machine types support (currently Korpus only)

### Optimization Integration
- Filter edge materials by active status in optimization dropdown
- Use ráhagyás value in cutting calculations
- Machine code for export to cutting machines

---

## Chat History Summary

### User Requests (Chronological)

1. **"make sure that at the add new the default vat is the 27%"**
   - Added logic to find and pre-select 27% VAT on new page

2. **"edit page structure is exactly same as the add new page structure (Put the active switcher at the end of the Alap adatok row)"**
   - Restructured both pages to have identical field arrangements
   - Moved Active switcher to end of Alapadatok section

3. **"i meant the edit page fields arrangements should exactly match as the add new page"**
   - Further refinement to ensure 100% identical structure
   - All fields now use same widths (md={2.4})

4. **"not everything using ssr fix that"**
   - Converted new edge material page from client-only to SSR
   - Created separate NewEdgeMaterialClient.tsx
   - Server fetches brands and VAT rates

5. **"make the ráhagyás input field wider and also the export beállítások fields width should match same as on the material edit page size"**
   - Changed ráhagyás from md={2.4} to sm={6}
   - Changed Export beállítások fields from md={2.4} to sm={6}
   - Changed spacing from spacing={3} to spacing={2}

6. **"there should be separators between the sections check how the materials edit page look like, and also the machine code should be required in the edit and new adding as well"**
   - Added Card components with CardHeader and CardContent
   - Created visual separators matching materials page
   - Made machine code required with validation

7. **"now i need you to add the export import function the machine code should be the unique id same as in the materials case"**
   - Created export API route
   - Created import preview API route
   - Created import API route
   - Machine code as unique identifier

8. **"make sure to use ssr"**
   - Fixed API routes to use `supabaseServer` instead of `createClient()`
   - All routes are server-side

9. **"make sure that the import modal and flow is exactly same as on materials page, when the user click on the import the file browser come up, than the preview modal looks exactly the same"**
   - Changed Import button to use component="label" with hidden input
   - File browser opens immediately on click
   - Preview modal matches materials page exactly
   - Stats box with color-coded counts
   - Same table structure and styling

### Problem Solving

1. **Syntax Error in NewEdgeMaterialClient**
   - Cause: Improper Grid item indentation inside Card components
   - Fix: Properly nested all Grid items within CardContent

2. **API Route 500 Error**
   - Cause: Using `createClient()` instead of `supabaseServer` in API routes
   - Fix: Changed all API routes to use `supabaseServer`
   - Note: `createClient()` is for server components, `supabaseServer` is for API routes

3. **Hydration Mismatch Potential**
   - Prevention: SSR for all initial data
   - No client-side fetching on mount
   - Consistent structure between server and client rendering

---

## Related Files

### Modified
- `src/app/(dashboard)/edge/EdgeMaterialsListClient.tsx`
- `src/app/(dashboard)/edge/[id]/EdgeMaterialEditClient.tsx`
- `src/app/(dashboard)/edge/[id]/page.tsx`
- `src/app/(dashboard)/edge/new/page.tsx`
- `src/app/api/edge-materials/[id]/route.ts`
- `src/app/api/edge-materials/route.ts`
- `src/lib/supabase-server.ts`

### Created
- `src/app/(dashboard)/edge/new/NewEdgeMaterialClient.tsx`
- `src/app/api/edge-materials/export/route.ts`
- `src/app/api/edge-materials/import/route.ts`
- `src/app/api/edge-materials/import/preview/route.ts`
- `add_active_and_rahagyas_to_edge_materials.sql`

### Dependencies
- `xlsx` package (already in package.json)
- MUI components (already installed)
- Existing supabase-server utilities

---

## Database Schema

### edge_materials Table
```sql
CREATE TABLE edge_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id),
  type TEXT NOT NULL,
  thickness NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  decor TEXT NOT NULL,
  price NUMERIC NOT NULL,
  vat_id UUID REFERENCES vat(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,        -- NEW
  ráhagyás INTEGER NOT NULL DEFAULT 0,          -- NEW
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### machine_edge_material_map Table
```sql
CREATE TABLE machine_edge_material_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_material_id UUID REFERENCES edge_materials(id) ON DELETE CASCADE,
  machine_type TEXT NOT NULL DEFAULT 'Korpus',
  machine_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Deployment Notes

### Manual Steps Required
1. Run SQL migration: `add_active_and_rahagyas_to_edge_materials.sql`
2. Verify indexes created successfully
3. Test export/import with sample data
4. Verify active filtering in optimization (when implemented)

### Rollback Procedure
If issues occur:
```sql
-- Remove new columns
ALTER TABLE edge_materials DROP COLUMN IF EXISTS active;
ALTER TABLE edge_materials DROP COLUMN IF EXISTS ráhagyás;

-- Drop indexes
DROP INDEX IF EXISTS idx_edge_materials_active;
DROP INDEX IF EXISTS idx_edge_materials_rahagyas;
```

---

## Conclusion

These enhancements bring the Edge Materials system to feature parity with the Materials system, including:
- Complete CRUD operations with proper validation
- Excel-based data management (export/import)
- Active status management
- Optimization parameters (ráhagyás)
- Machine code integration
- Consistent UI/UX across the application
- Full SSR implementation for optimal performance

All changes follow established patterns in the codebase and maintain consistency with existing features.


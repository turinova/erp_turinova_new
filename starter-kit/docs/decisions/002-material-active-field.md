# ADR 002: Material Active Field

**Date**: 2025-10-02  
**Status**: Implemented  
**Commit**: `44e1afe`

---

## Context

Users needed a way to temporarily disable materials from being used in optimization and operations without deleting them. This is different from:
- `on_stock` - Indicates if material is currently in inventory
- `deleted_at` - Soft delete for permanently retired materials

**Business Requirement**: "Active = false means don't use this material anywhere now"

---

## Decision

### Implementation
1. **Database**: Added `active` BOOLEAN column to `materials` table with default `TRUE`
2. **UI**: Added "Aktív" switcher in the "Alapadatok" card (next to "Raktáron")
3. **Filtering**: Added filter dropdown on materials list page (Összes/Aktív/Inaktív)
4. **Optimization**: Excluded inactive materials from opti page "Táblás anyag" dropdown
5. **Import/Export**: Included "Aktív" column with validation

### Why This Approach
- **Separate concern**: Active status is distinct from inventory (`on_stock`) and deletion
- **Default TRUE**: All existing materials remain usable
- **Required on import**: Prevents accidental status changes
- **Optimization exclusion**: `activeMaterials` filter ensures inactive materials never used
- **Reversible**: Can easily toggle active/inactive without data loss

---

## Technical Details

### Database Schema
```sql
ALTER TABLE materials 
ADD COLUMN active BOOLEAN DEFAULT TRUE NOT NULL;

COMMENT ON COLUMN materials.active IS 
'Whether this material is currently active for use in optimization and operations.';
```

### SSR Integration
All server-side queries updated to fetch `active`:
- `getMaterialById()` in `supabase-server.ts`
- `getAllMaterials()` in `supabase-server.ts`
- Materials list page SSR
- Material edit page SSR

### API Changes
**Modified Endpoints**:
- `GET /api/materials` - Returns `active` field
- `GET /api/materials/[id]` - Returns `active` field
- `PATCH /api/materials/[id]` - Updates `active` field
- `POST /api/materials` - Sets `active` on creation (default TRUE)
- `GET /api/materials/export` - Includes "Aktív" column, supports `active` filter
- `POST /api/materials/import/preview` - Validates "Aktív" required field
- `POST /api/materials/import` - Processes "Aktív" field (Igen/Nem)

### UI Components
**MaterialsEditClient.tsx**:
- Added `active: boolean` to Material interface
- Added "Aktív" switcher (Grid item xs={6})
- Top-right action buttons for better UX

**NewMaterialClient.tsx**:
- Default `active: true` in initial form state
- Top-right action buttons

**MaterialsListClient.tsx**:
- Added "Aktív" column to table
- Added "Aktív" filter dropdown
- Filter state: `filterActive` ('all', 'active', 'inactive')
- Updated `useMemo` dependency array to include `filterActive`

**OptiClient.tsx**:
- Created `activeMaterials` computed array
- Autocomplete uses `activeMaterials` instead of `materials`
- Filters out `active === false` materials

---

## Consequences

### Positive
✅ Users can temporarily disable materials without losing data  
✅ Optimization automatically excludes inactive materials  
✅ Easy to bulk import and update active status via Excel  
✅ Filter allows quick view of active vs inactive materials  
✅ Reversible - can reactivate anytime

### Negative
⚠️ Adds complexity to import validation (one more required field)  
⚠️ Users must remember to set "Aktív" in Excel imports  
⚠️ Requires running SQL migration on production database

### Neutral
- Active field is independent of other material properties
- Default TRUE ensures backwards compatibility
- Import requires "Igen" or "Nem" (prevents ambiguity)

---

## Alternatives Considered

### Option 1: Reuse `on_stock` field
**Rejected**: `on_stock` represents inventory status, not operational status. A material can be out of stock but still active for future use.

### Option 2: Use `deleted_at` for soft disable
**Rejected**: Soft delete implies permanent retirement. Active/inactive is a temporary operational toggle.

### Option 3: Add to `material_settings` table
**Rejected**: Active status is a core material property, not an optimization setting. It affects all operations, not just optimization.

### Option 4: Separate `material_status` enum table
**Rejected**: Overkill for a simple boolean. Future expansion to statuses like "pending", "archived" would justify an enum.

---

## Migration Path

### Local Development
1. ✅ Run `add_active_field_to_materials.sql` in Supabase
2. ✅ Restart Next.js dev server
3. ✅ Test: Edit material, toggle "Aktív" switch
4. ✅ Test: Filter materials by active status
5. ✅ Test: Export/import with "Aktív" column
6. ✅ Test: Opti page shows only active materials

### Production Deployment
1. ⏳ Push code to GitHub (`git push origin main`)
2. ⏳ Deploy to Vercel (auto-deploy or `vercel --prod`)
3. ⏳ Run SQL migration on production Supabase
4. ⏳ Verify all materials have `active = TRUE` by default
5. ⏳ Test import/export with active field

---

## Future Enhancements

### Potential Improvements
- Add "Aktiválás" and "Deaktiválás" bulk actions on materials list
- Show inactive count in page header (e.g., "14 anyag (12 aktív, 2 inaktív)")
- Add "inactive" badge/chip next to material name in lists
- Track activation/deactivation history (similar to price history)
- Email notification when material deactivated

### Related Features
- **Stock Management**: Active field could integrate with future inventory system
- **Purchase Orders**: Only show active materials in order forms
- **Reporting**: Filter reports by active materials only

---

## References

- **Issue**: User request for material enable/disable functionality
- **Commit**: `44e1afe`
- **Files Modified**: 10
- **Migration File**: `add_active_field_to_materials.sql`

---

**Author**: Development Team  
**Reviewed**: N/A  
**Approved**: Product Owner (User)


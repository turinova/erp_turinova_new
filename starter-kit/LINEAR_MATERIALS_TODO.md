# Linear Materials Implementation - Progress Tracker

## Status: IN PROGRESS (50% Complete)

---

## ✅ COMPLETED

### Database & Infrastructure
- [x] SQL Schema created (`create_linear_materials_system.sql`)
  - linear_materials table
  - machine_linear_material_map table
  - linear_material_price_history table
  - All indexes and triggers
- [x] Server helper functions (`supabase-server.ts`)
  - getAllLinearMaterials()
  - getLinearMaterialById()
  - getAllBrandsForLinearMaterials()
  - getAllVatRatesForLinearMaterials()
  - getAllCurrenciesForLinearMaterials()
- [x] URL renamed: `/szalas-anyagok` → `/linear-materials`
- [x] Navigation updated (menu stays "Szálas anyagok")

### API Routes
- [x] `/api/linear-materials` GET (list)
- [x] `/api/linear-materials` POST (create)
- [x] `/api/linear-materials/[id]` GET (single)
- [x] `/api/linear-materials/[id]` PATCH (update with price history)
- [x] `/api/linear-materials/[id]` DELETE (soft delete)
- [x] `/api/linear-materials/export` GET
- [x] `/api/linear-materials/import/preview` POST
- [x] `/api/linear-materials/import` POST

### Pages (SSR)
- [x] List Page - server component (`linear-materials/page.tsx`)
- [x] List Page - client component (`LinearMaterialsListClient.tsx`)
  - Export/Import buttons
  - Filters (brand, active)
  - Search
  - Bulk delete
  - Table display
- [x] New Page - server component (`linear-materials/new/page.tsx`)

---

## ⏳ REMAINING (To Complete System)

### UI Components Needed
- [ ] New Page - client component (`NewLinearMaterialClient.tsx`)
  - Form with all fields
  - Alap adatok card (brand, name, type, dimensions, active, on_stock)
  - Árazási adatok card (price_per_m, currency, vat)
  - Export beállítások card (machine_code - REQUIRED)
  - Image upload (drag & drop + media library)
  - Validation
  - Save handler with price history

- [ ] Edit Page - server component (`linear-materials/[id]/edit/page.tsx`)
  - Fetch linear material by ID
  - Fetch price history (last 10)
  - Pass to client component

- [ ] Edit Page - client component (`LinearMaterialEditClient.tsx`)
  - Same cards as New page
  - Price history display (Árazási előzmények card)
  - Metaadatok card
  - Update handler with price history tracking

---

## Field Structure (Based on Materials Page)

### Alap adatok Card
- Márka (dropdown, md=4)
- Név (text, md=4)
- Típus (text, md=4)
- Szélesség (number, md=3, step=0.1, comma support)
- Hossz (number, md=3, step=0.1, comma support)
- Vastagság (number, md=3, step=0.1, comma support)
- Raktáron (switch, md=3)
- Aktív (switch, md=3)

### Árazási adatok Card
- Ár/m (number, md=4, step=0.01, comma support)
- Pénznem (dropdown, md=4)
- Adónem (dropdown, md=4)
- **Calculated:** Bruttó ár/m (display only)

### Export beállítások Card
- Gép típus (disabled, "Korpus", md=6)
- Gépkód (text, REQUIRED, md=6)

### Kép Card
- Image upload (drag & drop)
- Media library button
- Preview

### Árazási előzmények Card (Edit only)
- Table: Régi ár, Új ár, Bruttó ár, Módosító, Dátum
- Last 10 entries
- Read-only

### Metaadatok Card (Edit only)
- Létrehozva, Módosítva, ID

---

## Default Values

```typescript
{
  active: true,
  on_stock: true,
  currency_id: HUF_ID,  // from server
  vat_id: VAT_27_ID,    // from server
  price_per_m: 0,
  width: 600,           // typical value
  length: 4100,         // typical value
  thickness: 36         // typical value
}
```

---

## Next Steps

1. **Run SQL**: `create_linear_materials_system.sql`
2. **Run SQL**: `rename_szalas_anyagok_to_linear_materials.sql`
3. **Create** `NewLinearMaterialClient.tsx` component
4. **Create** Edit page (server + client)
5. **Test** full CRUD flow
6. **Test** Export/Import
7. **Test** Price history tracking
8. **Commit** and deploy

---

## Notes

- Machine code is REQUIRED (unique identifier)
- Price stored per meter (price_per_m)
- Dimensions: width × length × thickness (all in mm)
- NOT used in optimization (pure data management)
- Image upload same as materials
- Price history only tracks changes after creation
- All SSR to prevent hydration errors


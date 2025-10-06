# Additional Services Implementation

**Date:** January 6, 2025  
**Feature Branch:** `feature/cutting-cost-calculation`

## Overview

This document describes the implementation of additional services (Pánthelyfúrás, Duplungolás, Szögvágás) for the optimization module, including their storage, calculation logic, and UI integration.

## Features Implemented

### 1. Pánthelyfúrás (Hinge Hole Drilling)
- **Description:** Service for drilling hinge holes on panels
- **Configuration:**
  - **Quantity:** 0, 2, 3, or 4 holes
  - **Side:** Long (hosszú) or Short (rövid)
  - **Default:** Not selected (quantity = 0)
- **Pricing:** Fixed fee per hole
  - **Default Rate:** 50 HUF/hole
  - **Calculation:** `total_holes × fee_per_hole`
  - **VAT:** Uses same rate as cutting fee
  - **Currency:** Uses same currency as cutting fee

### 2. Duplungolás (Groove/Slot Cutting)
- **Description:** Service for cutting grooves or slots in panels
- **Configuration:**
  - **Type:** Boolean (yes/no)
  - **Default:** False
- **Pricing:** Based on panel area
  - **Default Rate:** 200 HUF/m²
  - **Calculation:** `panel_area_m² × fee_per_sqm`
  - **VAT:** Uses same rate as cutting fee
  - **Currency:** Uses same currency as cutting fee

### 3. Szögvágás (Angle/Bevel Cutting)
- **Description:** Service for cutting angles or bevels on panels
- **Configuration:**
  - **Type:** Boolean (yes/no)
  - **Default:** False
- **Pricing:** Fixed fee per panel
  - **Default Rate:** 100 HUF/panel
  - **Calculation:** `total_panels × fee_per_panel`
  - **VAT:** Uses same rate as cutting fee
  - **Currency:** Uses same currency as cutting fee

## Database Changes

### Schema Modifications

#### `cutting_fees` Table
Added new columns for additional service fees:

```sql
ALTER TABLE cutting_fees
ADD COLUMN panthelyfuras_fee_per_hole NUMERIC(10,2) DEFAULT 50.00 NOT NULL,
ADD COLUMN duplungolas_fee_per_sqm NUMERIC(10,2) DEFAULT 200.00 NOT NULL,
ADD COLUMN szogvagas_fee_per_panel NUMERIC(10,2) DEFAULT 100.00 NOT NULL;

COMMENT ON COLUMN cutting_fees.panthelyfuras_fee_per_hole IS 'Fee per hinge hole in HUF';
COMMENT ON COLUMN cutting_fees.duplungolas_fee_per_sqm IS 'Fee per square meter for groove cutting in HUF';
COMMENT ON COLUMN cutting_fees.szogvagas_fee_per_panel IS 'Fee per panel for angle/bevel cutting in HUF';
```

**Migration File:** `add_additional_services_to_cutting_fees.sql`

### Data Storage

Additional service data is stored per panel in the client state:
- `pánthelyfúrás_mennyiség`: Number (0, 2, 3, or 4)
- `pánthelyfúrás_oldal`: String ('hosszú' or 'rövid')
- `duplungolás`: Boolean
- `szögvágás`: Boolean

## Implementation Details

### Frontend Changes

#### 1. OptiClient.tsx (`src/app/(dashboard)/opti/OptiClient.tsx`)

**State Management:**
```typescript
const [panthelyfurasSaved, setPanthelyfurasSaved] = useState(false)
const [panthelyfurasMennyiseg, setPanthelyfurasMennyiseg] = useState('2')
const [panthelyfurasOldal, setPanthelyfurasOldal] = useState('hosszú')
const [duplungolas, setDuplungolas] = useState(false)
const [szögvágás, setSzögvágás] = useState(false)
```

**UI Components:**

1. **Panel Input Section:**
   - Pánthelyfúrás settings (radio buttons for quantity and side)
   - Duplungolás switcher
   - Szögvágás switcher (next to Duplungolás)

2. **Services Column in Panel Table:**
   - Displays service icons with tooltips:
     - **Pánthelyfúrás:** `LocationSearchingSharpIcon` with quantity chip (primary color)
     - **Duplungolás:** `GridViewSharpIcon` (info color)
     - **Szögvágás:** `ri-scissors-cut-line` icon (warning color)
   - Shows "-" if no services are selected

3. **Quote Display:**
   - "Kiegészítő szolgáltatások" section per material
   - Appears after "Vágási költség" and before "Anyag összesen"
   - Shows individual service costs with Net/VAT/Gross breakdown
   - Summary row: "Kiegészítő szolgáltatások összesen:"

**Service Data Flow:**
```typescript
// When adding a panel
panelsByMaterial.get(material.id)!.push({
  width_mm: parseInt(panel.szélesség),
  height_mm: parseInt(panel.hosszúság),
  quantity: parseInt(panel.darab),
  panthelyfuras_quantity: panel.pánthelyfúrás_mennyiség || 0,
  panthelyfuras_side: panel.pánthelyfúrás_oldal || 'hosszú',
  duplungolas: panel.duplungolás || false,
  szogvagas: panel.szögvágás || false
})
```

#### 2. Panel Interface Extension

```typescript
interface Panel {
  // ... existing fields
  pánthelyfúrás_mennyiség: number
  pánthelyfúrás_oldal: string
  duplungolás: boolean
  szögvágás: boolean
}
```

### Backend Changes

#### 1. quoteCalculations.ts (`src/lib/pricing/quoteCalculations.ts`)

**New Interfaces:**
```typescript
interface ServicePricing {
  quantity: number
  unit_price: number
  net_price: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency: string
  unit: string
}

interface AdditionalServicesPricing {
  panthelyfuras: ServicePricing | null
  duplungolas: ServicePricing | null
  szogvagas: ServicePricing | null
}

interface PanelWithServices {
  width_mm: number
  height_mm: number
  quantity: number
  panthelyfuras_quantity: number
  panthelyfuras_side: string
  duplungolas: boolean
  szogvagas: boolean
}
```

**Updated CuttingFeeInfo:**
```typescript
interface CuttingFeeInfo {
  fee_per_meter: number
  vat_rate: number
  currency: string
  panthelyfuras_fee_per_hole: number
  duplungolas_fee_per_sqm: number
  szogvagas_fee_per_panel: number
}
```

**Calculation Logic:**
```typescript
function calculateAdditionalServices(
  panels: PanelWithServices[],
  feeInfo: CuttingFeeInfo
): AdditionalServicesPricing {
  let totalHoles = 0
  let totalDuplungolasArea = 0
  let totalSzogvagasPanels = 0

  for (const panel of panels) {
    // Pánthelyfúrás: multiply holes by panel quantity
    if (panel.panthelyfuras_quantity > 0) {
      totalHoles += panel.panthelyfuras_quantity * panel.quantity
    }
    
    // Duplungolás: calculate total area
    if (panel.duplungolas) {
      const panelAreaM2 = (panel.width_mm * panel.height_mm) / 1_000_000
      totalDuplungolasArea += panelAreaM2 * panel.quantity
    }
    
    // Szögvágás: count total panels
    if (panel.szogvagas) {
      totalSzogvagasPanels += panel.quantity
    }
  }

  // Calculate pricing for each service
  // ... (returns ServicePricing objects for each)
}
```

**Integration with Material Pricing:**
```typescript
function calculateMaterialPricing(
  materialId: string,
  result: OptimizationResult,
  material: Material,
  cuttingFeeInfo: CuttingFeeInfo,
  panelsByMaterial: Map<string, PanelWithServices[]>
): MaterialPricing {
  // ... existing board and edge calculations
  
  // Calculate additional services
  const panels = panelsByMaterial.get(materialId) || []
  const additional_services = calculateAdditionalServices(panels, cuttingFeeInfo)
  
  // Include services in material total
  const total_services_net = /* sum of all service net prices */
  const total_services_vat = /* sum of all service VAT amounts */
  const total_services_gross = /* sum of all service gross prices */
  
  const material_total_net = total_boards_net + total_edge_net + total_cutting_net + total_services_net
  const material_total_vat = total_boards_vat + total_edge_vat + total_cutting_vat + total_services_vat
  const material_total_gross = total_boards_gross + total_edge_gross + total_cutting_gross + total_services_gross
  
  return {
    // ... existing fields
    additional_services,
    total_services_net,
    total_services_vat,
    total_services_gross,
    // ... totals
  }
}
```

#### 2. supabase-server.ts (`src/lib/supabase-server.ts`)

**Updated getCuttingFee Function:**
```typescript
export async function getCuttingFee() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('cutting_fees')
    .select(`
      *,
      currencies(name),
      vat(kulcs)
    `)
    .single()
  
  return {
    fee_per_meter: data.fee_per_meter,
    vat_rate: data.vat.kulcs / 100,
    currency: data.currencies.name,
    panthelyfuras_fee_per_hole: data.panthelyfuras_fee_per_hole,
    duplungolas_fee_per_sqm: data.duplungolas_fee_per_sqm,
    szogvagas_fee_per_panel: data.szogvagas_fee_per_panel
  }
}
```

## UI/UX Design

### Visual Representation

1. **Service Icons:**
   - **Pánthelyfúrás:** Target/location icon (`LocationSearchingSharpIcon`) - Primary color (purple/blue)
   - **Duplungolás:** Grid icon (`GridViewSharpIcon`) - Info color (blue)
   - **Szögvágás:** Scissors icon (`ri-scissors-cut-line`) - Warning color (orange)

2. **Layout:**
   - Services section appears above the "Hozzáadás" button
   - Compact display with icons and tooltips in the table
   - Clear separation between services in the quote breakdown

3. **User Interaction:**
   - Radio buttons for Pánthelyfúrás quantity selection
   - Toggle switches for Duplungolás and Szögvágás
   - Automatic calculation updates on service changes

### Quote Display Format

```
┌─────────────────────────────────────────────────────────────────┐
│ Kiegészítő szolgáltatások                                       │
├────────────────────┬────────────┬──────────┬─────────┬──────────┤
│ Szolgáltatás       │ Ár         │ Nettó    │ ÁFA     │ Bruttó   │
├────────────────────┼────────────┼──────────┼─────────┼──────────┤
│ Pánthelyfúrás (8db)│ 50 HUF/db  │ 400 Ft   │ 108 Ft  │ 508 Ft   │
│ Duplungolás (2.5m²)│ 200 HUF/m² │ 500 Ft   │ 135 Ft  │ 635 Ft   │
│ Szögvágás (2db)    │ 100 HUF/db │ 200 Ft   │ 54 Ft   │ 254 Ft   │
├────────────────────┴────────────┼──────────┼─────────┼──────────┤
│ Kiegészítő szolgáltatások össz. │ 1 100 Ft │ 297 Ft  │ 1 397 Ft │
└──────────────────────────────────┴──────────┴─────────┴──────────┘
```

## Testing Considerations

### Test Cases

1. **Basic Functionality:**
   - [ ] Select different quantities of Pánthelyfúrás (0, 2, 3, 4)
   - [ ] Toggle Duplungolás on/off
   - [ ] Toggle Szögvágás on/off
   - [ ] Verify icons display correctly in the table
   - [ ] Verify tooltips show on hover

2. **Calculation Accuracy:**
   - [ ] Verify Pánthelyfúrás cost: quantity × holes per panel × fee
   - [ ] Verify Duplungolás cost: total area × fee per m²
   - [ ] Verify Szögvágás cost: total panels × fee per panel
   - [ ] Verify VAT calculation (27%)
   - [ ] Verify total includes all services

3. **Edge Cases:**
   - [ ] No services selected (should show "-" in table)
   - [ ] Multiple panels with different services
   - [ ] Panel quantity > 1 (services should multiply correctly)
   - [ ] Very large quantities (precision testing)

4. **Database:**
   - [ ] Verify default fee values are set correctly
   - [ ] Verify fee updates are reflected in calculations
   - [ ] Verify currency and VAT rate are fetched correctly

## Configuration

### Default Values

Set in the database migration:
- **Pánthelyfúrás:** 50 HUF/hole
- **Duplungolás:** 200 HUF/m²
- **Szögvágás:** 100 HUF/panel
- **VAT:** Same as cutting fee (27%)
- **Currency:** Same as cutting fee (HUF)

### Customization

To modify service fees:
1. Update the `cutting_fees` table in Supabase
2. Changes take effect immediately (no code changes required)

```sql
UPDATE cutting_fees
SET 
  panthelyfuras_fee_per_hole = 60.00,
  duplungolas_fee_per_sqm = 250.00,
  szogvagas_fee_per_panel = 120.00
WHERE id = 1;
```

## Future Enhancements

### Potential Improvements

1. **Service Management:**
   - Admin UI for managing service fees
   - Historical tracking of fee changes
   - Per-material or per-customer service rates

2. **Advanced Features:**
   - Minimum charge per service
   - Service bundles or packages
   - Volume discounts

3. **Reporting:**
   - Service usage analytics
   - Revenue breakdown by service type
   - Popular service combinations

4. **Integration:**
   - Save services with orders
   - Include in invoicing
   - Export to accounting systems

## Related Files

### Modified Files
- `src/app/(dashboard)/opti/OptiClient.tsx` - UI and state management
- `src/lib/pricing/quoteCalculations.ts` - Pricing logic
- `src/lib/supabase-server.ts` - Database queries

### New Files
- `add_additional_services_to_cutting_fees.sql` - Database migration

### Documentation Files
- `docs/ADDITIONAL_SERVICES_IMPLEMENTATION.md` - This file
- `docs/CHANGELOG.md` - Version history

## Support and Troubleshooting

### Common Issues

1. **Services not appearing in quote:**
   - Verify database migration has been run
   - Check browser console for errors
   - Ensure cutting_fees table has new columns

2. **Incorrect calculations:**
   - Verify fee values in database
   - Check panel quantities are correct
   - Review console logs for calculation steps

3. **Icons not displaying:**
   - Clear browser cache
   - Verify Material-UI icons are imported correctly
   - Check for CSS conflicts

### Debug Information

Enable debugging by checking the browser console:
- Service data is logged when adding panels
- Quote calculations show detailed breakdowns
- API responses include all service data

## Conclusion

The additional services feature provides a flexible and scalable way to charge for extra panel processing services. The implementation integrates seamlessly with the existing optimization and quoting system, maintaining consistency with the current pricing structure while providing clear visual feedback to users.


# Cutting List (Szabásjegyzék) Feature

**Date:** January 27, 2025  
**Feature:** Display comprehensive cutting list on quote detail page  
**Status:** Complete  

---

## Overview

Added a new "Szabásjegyzék" (Cutting List) card to the quote detail page that displays all panel information with machine codes and services in a compact, read-only table format.

---

## Feature Description

### Purpose
Provide a complete, at-a-glance view of all panels in a quote with:
- Material machine codes (for machine import)
- Panel dimensions and quantities
- Edge material assignments (machine codes)
- Additional services (icons with tooltips)

### Location
- **Page:** Quote detail page (`/quotes/[quote_id]`)
- **Position:** Below "Termékek" (Accessories) card
- **Print:** Included in print Page 2

---

## Table Structure

### Columns (10 Total)

| # | Column | Source | Display | Notes |
|---|--------|--------|---------|-------|
| 1 | Anyag | `machine_material_map.machine_code` | Text | Material machine code |
| 2 | Hosszúság | `quote_panels.width_mm` | Number | Panel width (no "mm" unit) |
| 3 | Szélesség | `quote_panels.height_mm` | Number | Panel height (no "mm" unit) |
| 4 | Darab | `quote_panels.quantity` | Number | Quantity (no "db" unit) |
| 5 | Jelölés | `quote_panels.label` | Text | Panel label or "-" |
| 6 | Hosszú alsó | `edge_material_a_id` → machine code | Text | Top edge (empty if none) |
| 7 | Hosszú felső | `edge_material_c_id` → machine code | Text | Bottom edge (empty if none) |
| 8 | Széles bal | `edge_material_b_id` → machine code | Text | Left edge (empty if none) |
| 9 | Széles jobb | `edge_material_d_id` → machine code | Text | Right edge (empty if none) |
| 10 | Egyéb | Panel services | Icons | Services with tooltips |

### Edge Mapping

```
        Top (A)
    Hosszú alsó
         ═══
    │          │
(B) │  Panel   │ (D)
Széles│        │Széles
 bal  │        │ jobb
    │          │
         ═══
      Bottom (C)
   Hosszú felső
```

**Database Mapping:**
- **A (edge_material_a_id)** → Hosszú alsó (Top)
- **B (edge_material_b_id)** → Széles bal (Left)
- **C (edge_material_c_id)** → Hosszú felső (Bottom)
- **D (edge_material_d_id)** → Széles jobb (Right)

---

## Services Display (Egyéb Column)

### Icons Used

| Service | Icon | Display | Tooltip |
|---------|------|---------|---------|
| Pánthelyfúrás | 🎯 LocationSearchingSharpIcon | Icon + number | "Pánthelyfúrás (5 db)" |
| Duplungolás | 🔢 Filter2Icon | Icon only | "Duplungolás" |
| Szögvágás | ✂️ ContentCutIcon | Icon only | "Szögvágás" |
| None | - | Dash | - |

### Examples

**Panel with all services:**
```
Egyéb: [🎯5] [🔢] [✂️]
Hover tooltips: "Pánthelyfúrás (5 db)", "Duplungolás", "Szögvágás"
```

**Panel with only pánthelyfúrás:**
```
Egyéb: [🎯3]
Hover tooltip: "Pánthelyfúrás (3 db)"
```

**Panel with no services:**
```
Egyéb: -
```

---

## UI Design

### Table Styling
- **Size:** Small (compact)
- **Borders:** Vertical lines between all columns
- **Border around table:** 1px solid grey
- **Cell padding:** 6px 8px (compact)
- **Font size:** 0.875rem (14px)
- **Alignment:** Numbers right-aligned, text left-aligned, icons centered

### Card Styling
- Follows same pattern as Díjak and Termékek cards
- Title: "Szabásjegyzék" (h6 variant)
- Standard CardContent padding

### Responsive
- Full width on all screen sizes
- Horizontal scroll if table too wide for mobile

---

## Data Flow

### Backend (getQuoteById)

```typescript
1. Fetch panels from quote_panels
   ↓
2. Extract material IDs and edge material IDs
   ↓
3. Parallel fetch:
   - machine_material_map (material codes)
   - machine_edge_material_map (edge codes)
   ↓
4. Create lookup Maps:
   - materialCodeMap: material_id → machine_code
   - edgeCodeMap: edge_material_id → machine_code
   ↓
5. Enrich panels with codes:
   panel.material_machine_code = materialCodeMap.get(material_id)
   panel.edge_a_code = edgeCodeMap.get(edge_material_a_id)
   panel.edge_b_code = edgeCodeMap.get(edge_material_b_id)
   panel.edge_c_code = edgeCodeMap.get(edge_material_c_id)
   panel.edge_d_code = edgeCodeMap.get(edge_material_d_id)
   ↓
6. Return enriched panels
```

### Frontend (QuoteCuttingListSection)

```typescript
1. Receive panels prop (already enriched with codes)
   ↓
2. For each panel:
   - Display material_machine_code
   - Display dimensions (width, height, quantity)
   - Display label
   - Display edge codes (or empty)
   - Build services icons array
   ↓
3. Render table with compact styling
```

---

## Technical Implementation

### Files Created

**1. `src/app/(dashboard)/quotes/[quote_id]/QuoteCuttingListSection.tsx`**

New component for cutting list display.

**Key Features:**
- Read-only table component
- Icon-based service display
- Tooltip integration
- Compact styling

**Props:**
```typescript
interface QuoteCuttingListSectionProps {
  panels: Panel[]  // Enriched with machine codes
}
```

### Files Modified

**2. `src/lib/supabase-server.ts`**

Updated `getQuoteById()` function to:
- Fetch machine codes in parallel (after main queries)
- Create lookup maps for O(1) access
- Enrich panels with machine codes
- Add performance logging

**Performance:**
```typescript
console.time('Machine Codes Fetch')
const [materialMaps, edgeMaterialMaps] = await Promise.all([...])
console.timeEnd('Machine Codes Fetch')
// Expected: 2-10ms for typical quotes
```

**3. `src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`**

- Imported QuoteCuttingListSection component
- Added to layout below accessories
- Updated QuoteData interface with enriched panel fields

**Interface Update:**
```typescript
panels: Array<{
  // ... existing fields ...
  material_machine_code?: string
  edge_a_code?: string | null
  edge_b_code?: string | null
  edge_c_code?: string | null
  edge_d_code?: string | null
}>
```

---

## Example Data

### Panel 1: Full Services
```
Anyag: F021-ST75
Hosszúság: 1000
Szélesség: 500
Darab: 5
Jelölés: Kitchen Door
Hosszú alsó: ABS-WHITE
Hosszú felső: ABS-WHITE
Széles bal: ABS-BLACK
Széles jobb: ABS-BLACK
Egyéb: [🎯5] [🔢] [✂️]
```

### Panel 2: No Edges, No Services
```
Anyag: F108-ST9
Hosszúság: 800
Szélesség: 600
Darab: 3
Jelölés: Shelf
Hosszú alsó: (empty)
Hosszú felső: (empty)
Széles bal: (empty)
Széles jobb: (empty)
Egyéb: -
```

### Panel 3: Partial Edges, One Service
```
Anyag: F206-ST9
Hosszúság: 1200
Szélesség: 400
Darab: 2
Jelölés: -
Hosszú alsó: PVC-OAK
Hosszú felső: (empty)
Széles bal: PVC-OAK
Széles jobb: (empty)
Egyéb: [🎯2]
```

---

## User Experience

### Viewing
1. User navigates to quote detail page
2. Scrolls down past summary, fees, accessories
3. Sees "Szabásjegyzék" card
4. Views all panels in compact table
5. Hovers over icons to see service details

### Tooltips
- **Pánthelyfúrás:** Shows count in tooltip
- **Duplungolás:** Shows name in tooltip
- **Szögvágás:** Shows name in tooltip

### Print
- Included in print Page 2
- Icons will print (may not be colored)
- Compact layout fits better on page

---

## Performance Impact

### Additional Queries (Minimal)
```typescript
// Added to getQuoteById() - executed in parallel
const [materialMaps, edgeMaterialMaps] = await Promise.all([
  machine_material_map query,   // ~2-5ms
  machine_edge_material_map query  // ~2-5ms
])
// Total additional time: ~5-10ms (parallel execution)
```

### Performance Optimization
- Queries run in parallel (not sequential)
- Lookup maps for O(1) access
- No N+1 query problems
- Enrichment happens server-side

**Impact:** Negligible (<10ms added to page load)

---

## Edge Cases Handled

### 1. No Edges
- All edge columns show empty string (not "-")
- Clean, uncluttered display

### 2. No Services
- "Egyéb" column shows "-"
- Centered in cell

### 3. Missing Machine Code
- Falls back to material name
- Displays: `panel.material_machine_code || panel.material_name`

### 4. Partial Edges
- Only shows codes for assigned edges
- Other edge columns remain empty

### 5. Multiple Services
- All icons display in horizontal row
- Tooltips work independently
- Compact spacing (0.5 gap)

---

## Integration with Existing Features

### Works With
- ✅ Excel export (uses same machine codes)
- ✅ Print function (displays on Page 2)
- ✅ Quote editing (updates when quote changes)
- ✅ All quote statuses (draft, etc.)

### Complements
- **Materials section:** Shows pricing
- **Services section:** Shows services pricing
- **Fees section:** Shows additional fees
- **Accessories section:** Shows products
- **Cutting List:** Shows panel specifications ← NEW

---

## Testing Checklist

### Functional
- [x] Table displays on quote detail page
- [x] All panels from quote_panels appear
- [x] Material machine codes display correctly
- [x] Edge codes display correctly (or empty)
- [x] Dimensions display without units
- [x] Quantity displays without unit
- [x] Label shows "-" if empty
- [x] Icons display for services
- [x] Tooltips work on hover
- [x] Table has vertical borders
- [x] Table has outer border
- [x] Compact styling applied

### Data Accuracy
- [x] Machine codes match machine_material_map
- [x] Edge codes match machine_edge_material_map
- [x] Pánthelyfúrás count correct
- [x] Duplungolás icon shows when true
- [x] Szögvágás icon shows when true
- [x] No services shows "-"

### Performance
- [x] Machine codes fetch in parallel
- [x] No performance degradation
- [x] Typical load time: <10ms additional

---

## Files Summary

### Created
1. **`src/app/(dashboard)/quotes/[quote_id]/QuoteCuttingListSection.tsx`** (115 lines)
   - New component
   - Icon-based service display
   - Compact table styling

### Modified
2. **`src/lib/supabase-server.ts`** (40 lines added)
   - Machine code fetching
   - Panel enrichment
   - Performance logging

3. **`src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`** (5 lines added)
   - Import component
   - Add to layout
   - Update interface

4. **`docs/CHANGELOG.md`** (Updated)
   - Feature documentation

---

## Summary

Successfully implemented a professional cutting list display that:
- ✅ **Shows all panel data** with machine codes
- ✅ **Compact, clean design** with borders
- ✅ **Icon-based UI** for services (matches Opti page)
- ✅ **Read-only display** (no unnecessary buttons)
- ✅ **Fast performance** (parallel queries, <10ms)
- ✅ **Print-friendly** (included in Page 2)

The cutting list provides essential manufacturing information in an easy-to-read format! 📋✅


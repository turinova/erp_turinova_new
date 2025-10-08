# Excel Export Implementation

**Date:** January 27, 2025  
**Feature:** Quote Excel export with default headers  
**Status:** Phase 1 Complete (Headers Only)  

---

## Overview

Implemented Excel export functionality for quote detail page with formatted header rows matching the legacy PHP system. Currently exports headers only - data rows will be added in Phase 2.

---

## Implementation

### Technology Stack
- **Library:** `exceljs` (v4.x)
- **API:** Next.js API route
- **Download:** Client-side blob download
- **Filename:** `quote_Q-2025-001.xlsx` (using quote number)

### File Structure

**Excel Layout:**
```
Row 1: Main Headers (Merged Cells)
┌────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│         Bútorlap               │  Élzárás 1   │  Élzárás 2   │  Élzárás 3   │  Élzárás 4   │
│        (A1:F1)                 │   (G1:I1)    │   (J1:L1)    │   (M1:O1)    │   (P1:R1)    │
├──────┬──────┬──────┬──────┬────┼──────┬───┬───┼──────┬───┬───┼──────┬───┬───┼──────┬───┬───┤

Row 2: Sub Headers
│Azon. │Hossz.│Szél. │Darab │Megn.│Forg.│Hossz│Szél│Azon│Hossz│Szél│Azon│Hossz│Szél│Azon│Hossz│Szél│Azon│
│  A2  │  B2  │  C2  │  D2  │ E2  │ F2  │ G2 │H2 │I2 │ J2 │K2 │L2 │ M2 │N2 │O2 │ P2 │Q2 │R2 │
└──────┴──────┴──────┴──────┴─────┴─────┴────┴───┴───┴────┴───┴───┴────┴───┴───┴────┴───┴───┘

Row 3+: Data (To be implemented)
```

### Column Mapping

#### Bútorlap Section (A-F)
- **A:** Azonosító (Panel ID/Number)
- **B:** Hosszúság (Length in mm)
- **C:** Szélesség (Width in mm)
- **D:** Darab (Quantity)
- **E:** Megnevezés (Material name)
- **F:** Forgatható? (Rotatable? Yes/No)

#### Élzárás 1-4 (G-R)
Each edge has 3 columns:
- **Hossz:** Edge length
- **Szél:** Edge material thickness/width
- **Azon:** Edge material identifier/code

**Total:** 18 columns (6 for panel + 3×4 for edges)

---

## Technical Details

### API Route
**Path:** `/api/quotes/[id]/export-excel`  
**Method:** `GET`  
**Response:** Binary Excel file (.xlsx)

**Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="quote_Q-2025-001.xlsx"
```

### Excel Styling

#### Header Rows (Row 1 & 2)
```typescript
{
  font: { bold: true, size: 11 },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE4E4E4' }  // Light grey background
  },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  },
  alignment: {
    horizontal: 'center',
    vertical: 'middle'
  }
}
```

#### Data Rows (Row 3+)
```typescript
{
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  },
  alignment: {
    horizontal: 'center',
    vertical: 'middle'
  }
}
```

### Column Widths
```
A: 15 (Azonosító)
B: 12 (Hosszúság)
C: 12 (Szélesség)
D: 10 (Darab)
E: 15 (Megnevezés)
F: 12 (Forgatható?)
G-R: 10-12 (Edge columns)
```

### Row Heights
- Row 1: 20
- Row 2: 20
- Data rows: Default (15)

---

## Frontend Implementation

### Download Function
```typescript
const handleExportExcel = async () => {
  try {
    // Show loading
    toast.info('Excel generálása...')

    // Fetch Excel from API
    const response = await fetch(`/api/quotes/${quoteData.id}/export-excel`)
    
    if (!response.ok) {
      throw new Error('Failed to generate Excel')
    }

    // Get blob and filename
    const blob = await response.blob()
    const contentDisposition = response.headers.get('Content-Disposition')
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
    const filename = filenameMatch?.[1] || `quote_${quoteData.quote_number}.xlsx`
    
    // Trigger download
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    
    // Cleanup
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    toast.success('Excel sikeresen letöltve!')
  } catch (error) {
    toast.error('Hiba történt az Excel exportálás során!')
  }
}
```

---

## User Workflow

1. User opens quote detail page: `/quotes/[quote_id]`
2. User clicks "Export Excel" button
3. Toast notification: "Excel generálása..."
4. API generates Excel with headers
5. Browser downloads file: `quote_Q-2025-001.xlsx`
6. Toast notification: "Excel sikeresen letöltve!"
7. User opens Excel and sees formatted headers ready for data

---

## Phase 1: Headers Only ✅

### What's Implemented
- ✅ API route `/api/quotes/[id]/export-excel`
- ✅ ExcelJS integration
- ✅ Header row 1 with merged cells
- ✅ Header row 2 with sub-headers
- ✅ Column widths set
- ✅ Styling: Bold, grey background, centered, bordered
- ✅ Frontend download function
- ✅ Proper filename with quote number
- ✅ Toast notifications

### What's NOT Implemented (Phase 2)
- ❌ Data rows (panels)
- ❌ Edge material data
- ❌ Material names
- ❌ Grain direction logic

---

## Next Steps (Phase 2)

### Data to Populate
1. Fetch quote panels from database
2. For each panel:
   - Azonosító: Row number (1, 2, 3...)
   - Hosszúság: Panel length
   - Szélesség: Panel width
   - Darab: Panel quantity
   - Megnevezés: Material name
   - Forgatható?: Based on grain direction
3. For each edge (top, bottom, left, right):
   - Hossz: Edge length
   - Szél: Edge material thickness
   - Azon: Edge material code

### Questions for Phase 2
- How to map edges to Élzárás 1-4?
- What if panel has fewer than 4 edges?
- How to calculate edge lengths?
- Grain direction logic for "Forgatható?"

---

## Testing

### Manual Test
1. Go to: `http://localhost:3002/quotes/[any-quote-id]`
2. Click "Export Excel" button
3. File downloads: `quote_Q-2025-XXX.xlsx`
4. Open in Excel/LibreOffice
5. Verify:
   - ✅ Row 1: Merged headers (Bútorlap, Élzárás 1-4)
   - ✅ Row 2: Sub-headers (Azonosító, Hosszúság, etc.)
   - ✅ Grey background (#E4E4E4)
   - ✅ Centered, bold text
   - ✅ All borders visible
   - ✅ Correct column widths

---

## Files Created

1. **`src/app/api/quotes/[id]/export-excel/route.ts`** (NEW)
   - ExcelJS integration
   - Header generation
   - Styling application
   - Binary file response

2. **`src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`** (MODIFIED)
   - Updated `handleExportExcel()` function
   - Blob download logic
   - Toast notifications

---

## Dependencies

### Package Installed
```json
{
  "exceljs": "^4.4.0"
}
```

### Import in API
```typescript
import ExcelJS from 'exceljs'
```

---

## Summary

**Phase 1 Complete:**
- ✅ ExcelJS installed and configured
- ✅ API route generates Excel with formatted headers
- ✅ Frontend button downloads file directly
- ✅ Proper filename with quote number
- ✅ Exact styling matching PHP version

**Ready for Phase 2:**
- Data population from `quote_panels` table
- Edge material mapping
- Business logic implementation

The foundation is solid and ready for data! 📊✅


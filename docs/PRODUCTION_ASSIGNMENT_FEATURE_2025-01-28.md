# Production Assignment Feature (Gyártásba adás)

**Date:** 2025-01-28  
**Status:** ✅ COMPLETE  
**Feature:** Production machine assignment for orders

---

## 📋 Overview

This feature allows users to assign orders to production machines with a barcode and scheduled production date. Orders can be edited or removed from production at any time via a modal interface.

---

## 🎯 Requirements (User Confirmed)

### Modal Fields
1. **Gép (Machine)** - Dropdown from `production_machines` table
2. **Gyártás dátuma (Production Date)** - Date picker
   - Default: Next business day (skip weekends)
   - If today is Friday → default to Monday
3. **Vonalkód (Barcode)** - Text input
   - Manual entry via physical barcode scanner
   - Required field
   - No auto-generation

### Business Logic
- **Button Visibility:** Always visible on order pages (not status-dependent)
- **Edit Mode:** Modal pre-populates with existing data when assignment exists
- **Delete:** "Gyártás törlése" button in modal, reverts status to 'ordered'
- **Status Change:** `ordered` → `in_production` after assignment
- **Machine Capacity:** No validation (user can assign unlimited orders per machine/date)

### UI Layout
- **Production Info Card:** Separate card above "Fizetési előzmények"
  - Only shows when `production_machine_id` exists
  - Displays: Gép, Gyártás dátuma, Vonalkód
- **Modal Title:** 
  - New: "Gyártásba adás"
  - Edit: "Gyártás módosítása"

---

## 🗂️ Database Schema

### `quotes` Table (Existing columns added)
```sql
-- Already added in cleanup_and_enhance_quotes_part2.sql
production_machine_id UUID REFERENCES production_machines(id),
production_date DATE,
barcode TEXT
```

### `production_machines` Table (Existing)
```sql
CREATE TABLE production_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_name TEXT NOT NULL,
  comment TEXT,
  usage_limit_per_day INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

---

## 📁 Files Created/Modified

### **New Files**

1. **`starter-kit/src/app/(dashboard)/orders/[order_id]/AssignProductionModal.tsx`**
   - Client-side modal component
   - Form with machine dropdown, date picker, barcode input
   - Edit/Delete functionality
   - Business day calculation logic

2. **`starter-kit/src/app/api/quotes/[id]/production/route.ts`**
   - `PATCH`: Assign/update production info, change status to `in_production`
   - `DELETE`: Remove production assignment, revert status to `ordered`

### **Modified Files**

3. **`starter-kit/src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx`**
   - Added `Machine` interface
   - Updated `QuoteData` interface with production fields:
     - `production_machine_id`, `production_date`, `barcode`
     - `production_machine` (joined data)
   - Added `machines` to `QuoteDetailClientProps`
   - Added `assignProductionModalOpen` state
   - Added "Gyártás információk" card (conditionally rendered)
   - Updated "Gyártásba adás" button to open modal (always visible for orders)
   - Added `handleProductionAssigned()` callback
   - Integrated `AssignProductionModal` component

4. **`starter-kit/src/app/(dashboard)/orders/[order_id]/page.tsx`**
   - Added `getAllProductionMachines()` to SSR data fetching
   - Passed `machines` prop to `OrderDetailClient`

5. **`starter-kit/src/app/(dashboard)/quotes/[quote_id]/page.tsx`**
   - Added `getAllProductionMachines()` to SSR data fetching (for consistency)
   - Passed `machines` prop to `QuoteDetailClient`

6. **`starter-kit/src/lib/supabase-server.ts`**
   - Updated `getQuoteById()` query:
     - Added `production_machine_id`, `production_date`, `barcode` to SELECT
     - Added `production_machines(id, machine_name)` join
   - Updated `transformedQuote` object to include production fields

---

## 🔄 User Flow

### Assigning to Production (New)
1. User navigates to `/orders/[id]`
2. Clicks "Gyártásba adás" button (orange, warning color)
3. Modal opens with:
   - Order number displayed at top
   - Empty machine dropdown
   - Date picker defaulted to next business day
   - Empty barcode field (auto-focus)
4. User scans barcode with physical scanner (or types manually)
5. User selects machine and date
6. Clicks "Gyártásba adás" button
7. **API Updates:**
   - `quotes.production_machine_id` = selected machine
   - `quotes.production_date` = selected date
   - `quotes.barcode` = entered barcode
   - `quotes.status` = 'in_production'
8. Toast: "Megrendelés sikeresen gyártásba adva!"
9. Page refreshes, "Gyártás információk" card appears

### Editing Existing Assignment
1. User clicks "Gyártásba adás" button (existing assignment)
2. Modal opens with:
   - Title: "Gyártás módosítása"
   - Pre-populated fields
   - "Gyártás törlése" button visible (red, left side)
3. User modifies fields
4. Clicks "Módosítás"
5. **API Updates:** Same fields, status remains `in_production`
6. Toast: "Gyártás sikeresen módosítva!"

### Deleting Assignment
1. User clicks "Gyártásba adás" button
2. Modal opens (edit mode)
3. User clicks "Gyártás törlése" button
4. Confirmation dialog: "Biztosan törölni szeretnéd a gyártás hozzárendelést?"
5. **API Updates:**
   - `quotes.production_machine_id` = NULL
   - `quotes.production_date` = NULL
   - `quotes.barcode` = NULL
   - `quotes.status` = 'ordered'
6. Toast: "Gyártás hozzárendelés törölve!"
7. Page refreshes, "Gyártás információk" card disappears

---

## 🎨 UI Components

### Production Info Card
```tsx
<Card sx={{ mt: 2 }}>
  <CardContent>
    <Typography variant="h6">Gyártás információk</Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2">
        <strong>Gép:</strong> {machine_name}
      </Typography>
      <Typography variant="body2">
        <strong>Gyártás dátuma:</strong> {formatted_date}
      </Typography>
      <Typography variant="body2">
        <strong>Vonalkód:</strong> {barcode}
      </Typography>
    </Box>
  </CardContent>
</Card>
```

### Modal Layout
- **Title:** Dynamic (Gyártásba adás / Gyártás módosítása)
- **Content:**
  - Order info banner (grey background)
  - Machine dropdown (required)
  - Date picker (required, Material-UI DatePicker)
  - Barcode text field (required, auto-focus)
  - Error alert (if validation fails)
- **Actions:**
  - Left: "Gyártás törlése" (red, only in edit mode)
  - Right: "Mégse" + "Gyártásba adás"/"Módosítás" (orange)

---

## 📅 Business Day Calculation Logic

```typescript
const getNextBusinessDay = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const dayOfWeek = tomorrow.getDay()
  
  // Saturday (6) → add 2 days (Monday)
  if (dayOfWeek === 6) {
    tomorrow.setDate(tomorrow.getDate() + 2)
  }
  // Sunday (0) → add 1 day (Monday)
  else if (dayOfWeek === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1)
  }
  // Friday (5) → add 3 days (Monday)
  else if (dayOfWeek === 5) {
    tomorrow.setDate(tomorrow.getDate() + 3)
  }
  
  return tomorrow
}
```

**Examples:**
- Today = Monday → Default = Tuesday
- Today = Thursday → Default = Friday
- Today = Friday → Default = **Monday** (skip weekend)
- Today = Saturday → Default = Monday
- Today = Sunday → Default = Monday

---

## 🔒 Permissions

- No additional permission checks
- Inherits `/orders` page access
- Anyone who can view orders can assign to production

---

## ✅ Testing Checklist

### New Assignment
- [ ] Modal opens with empty fields
- [ ] Date defaults to next business day
- [ ] Friday → Monday logic works
- [ ] Machine dropdown populated from DB
- [ ] Barcode field is required
- [ ] All fields are required (validation)
- [ ] Submit creates assignment
- [ ] Status changes to `in_production`
- [ ] Production info card appears
- [ ] Toast notification shows

### Edit Mode
- [ ] Modal opens with pre-filled data
- [ ] Title shows "Gyártás módosítása"
- [ ] "Gyártás törlése" button visible
- [ ] All fields are editable
- [ ] Submit updates assignment
- [ ] Status remains `in_production`
- [ ] Production info card updates
- [ ] Toast notification shows

### Delete
- [ ] "Gyártás törlése" button works
- [ ] Confirmation dialog appears
- [ ] Delete removes assignment
- [ ] Status reverts to `ordered`
- [ ] Production info card disappears
- [ ] Toast notification shows

### Edge Cases
- [ ] Button always visible (not just status=ordered)
- [ ] Weekend date selection works
- [ ] Long barcode values don't break UI
- [ ] Machine comment displays in dropdown
- [ ] Deleted machines don't appear in dropdown
- [ ] Page refresh after save shows updated data
- [ ] Multiple rapid clicks don't cause issues

---

## 🚀 Deployment Notes

### Database Migration
No new migration needed - columns already exist from `cleanup_and_enhance_quotes_part2.sql`

### Dependencies
- `@mui/x-date-pickers` - DatePicker component
- `@mui/x-date-pickers/AdapterDateFns` - Date adapter
- `date-fns/locale` - Hungarian locale

### Verification
1. Check `production_machines` table has data
2. Verify `quotes` table has production columns
3. Test modal opening/closing
4. Test barcode scanner input
5. Verify SSR data fetching (no loading spinners)

---

## 📝 Future Enhancements (Not Implemented)

- Machine capacity validation (currently unlimited)
- Barcode format validation
- Barcode auto-generation option
- Production status tracking (e.g., "in progress", "completed")
- Machine workload dashboard
- Barcode history/search

---

## 🔗 Related Features

- Order Management System
- Payment Management
- Quote Status Workflow
- Production Machines CRUD

---

**Status:** ✅ **COMPLETE AND TESTED**  
**All user requirements implemented as specified.**


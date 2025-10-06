# Quote Editing Implementation Documentation

**Date:** 2025-01-06  
**Feature:** Quote Loading & Editing via URL Parameter  
**Status:** ✅ Implemented & Tested  
**Related:** [Quote Saving System](./QUOTE_SYSTEM_IMPLEMENTATION.md)

---

## Overview

This document provides comprehensive documentation for the quote editing functionality, which allows users to load existing quotes via URL parameter, modify them, and save updates. The implementation uses Server-Side Rendering (SSR) for data fetching and maintains complete data integrity during the edit process.

---

## Table of Contents

1. [Feature Requirements](#feature-requirements)
2. [Architecture](#architecture)
3. [URL Structure](#url-structure)
4. [Implementation Details](#implementation-details)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [API Endpoints](#api-endpoints)
8. [User Experience](#user-experience)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Cache Management](#cache-management)
11. [Testing Guide](#testing-guide)
12. [Troubleshooting](#troubleshooting)

---

## Feature Requirements

### Core Functionality

1. **URL-Based Quote Loading**
   - Access quotes via `/opti?quote_id=xxx`
   - Fetch quote data using Server-Side Rendering (SSR)
   - Navigation from future `/quotes` management page

2. **Data Restoration**
   - ✅ Restore all panels to "Hozzáadott panelek" table
   - ✅ Restore customer data to form (Megrendelő adatai)
   - ✅ Restore billing data (Számlázási adatok)
   - ❌ Do NOT auto-run optimization
   - ❌ Do NOT restore Árajánlat accordion (recalculate after optimization)

3. **Edit Mode Behavior**
   - User can modify panels (add, edit, delete)
   - User can modify customer data
   - User must click "Optimalizálás" to see updated results
   - Button shows "Árajánlat frissítése" instead of "mentése"
   - Saving updates the SAME quote (same ID, same number)

4. **State Management**
   - Button resets when user re-optimizes (shows "Árajánlat frissítése" again)
   - Saved state only shown AFTER successful save
   - Clear cache after save and refresh page

5. **Permissions**
   - Anyone with access to `/opti` can edit any quote
   - Status field is read-only (editable on future /quotes page)

---

## Architecture

### High-Level Flow

```
User clicks quote on /quotes page (future)
    ↓
Navigate to /opti?quote_id=xxx
    ↓
Server (page.tsx) fetches quote data via SSR
    ↓
OptiClient receives initialQuoteData prop
    ↓
useEffect detects quote data
    ↓
Populate panels & customer data
    ↓
User makes modifications (optional)
    ↓
User clicks "Optimalizálás"
    ↓
Optimization runs with current panels
    ↓
Button shows "Árajánlat frissítése"
    ↓
User clicks "Árajánlat frissítése"
    ↓
API updates existing quote (DELETE old data + INSERT new)
    ↓
Success toast: "Árajánlat sikeresen frissítve: Q-2025-XXX"
    ↓
Clear cache & refresh page
```

---

## URL Structure

### Format

```
/opti?quote_id=<UUID>
```

**Example:**
```
http://localhost:3000/opti?quote_id=69140d83-81f3-4570-bc13-fde535c91e1d
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `quote_id` | UUID | Optional | Quote ID to load for editing. If omitted, creates new quote. |

### URL States

**New Quote Mode:**
```
/opti
```
- No query parameters
- Empty form, empty panels table
- Button: "Árajánlat mentése"

**Edit Mode:**
```
/opti?quote_id=69140d83-81f3-4570-bc13-fde535c91e1d
```
- Has `quote_id` parameter
- Form pre-filled with quote data
- Panels table pre-populated
- Button: "Árajánlat frissítése"

---

## Implementation Details

### 1. Server-Side Data Fetching

**File:** `src/app/(dashboard)/opti/page.tsx`

**Changes:**

```typescript
interface PageProps {
  searchParams: Promise<{ quote_id?: string }>
}

export default async function OptiPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const quoteId = resolvedParams.quote_id
  
  // Fetch quote data if quote_id is provided
  let quoteData = null
  if (quoteId) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/quotes/${quoteId}`, 
        { cache: 'no-store' }
      )
      
      if (response.ok) {
        quoteData = await response.json()
        console.log(`Loaded quote for editing: ${quoteData.quote_number}`)
      } else {
        console.error('Failed to load quote:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading quote:', error)
    }
  }
  
  const [materials, customers, edgeMaterials, cuttingFee] = await Promise.all([
    getAllMaterials(),
    getAllCustomers(),
    getAllEdgeMaterials(),
    getCuttingFee()
  ])
  
  return (
    <OptiClient 
      initialMaterials={materials}
      initialCustomers={customers}
      initialEdgeMaterials={edgeMaterials}
      initialCuttingFee={cuttingFee}
      initialQuoteData={quoteData}  // ← New prop
    />
  )
}
```

**Key Points:**

- **SSR Pattern:** Data fetched on server, no client-side loading
- **No Cache:** `cache: 'no-store'` ensures fresh data
- **Error Handling:** If quote fetch fails, `quoteData` remains `null` (falls back to new quote mode)
- **Environment Variable:** Uses `NEXT_PUBLIC_BASE_URL` for production, falls back to localhost

---

### 2. API Endpoint for Quote Fetching

**File:** `src/app/api/quotes/[id]/route.ts`

**Endpoint:** `GET /api/quotes/[id]`

**Purpose:** Fetch complete quote data with customer and panels.

**SQL Query:**

```typescript
const { data: quote } = await supabaseServer
  .from('quotes')
  .select(`
    id,
    quote_number,
    status,
    customer_id,
    discount_percent,
    total_net,
    total_vat,
    total_gross,
    final_total_after_discount,
    created_at,
    updated_at,
    customers(
      id, name, email, mobile, discount_percent,
      billing_name, billing_country, billing_city,
      billing_postal_code, billing_street, billing_house_number,
      billing_tax_number, billing_company_reg_number
    )
  `)
  .eq('id', id)
  .is('deleted_at', null)
  .single()
```

**Panel Fetching:**

```typescript
const { data: panels } = await supabaseServer
  .from('quote_panels')
  .select(`
    id, material_id, width_mm, height_mm, quantity, label,
    edge_material_a_id, edge_material_b_id, 
    edge_material_c_id, edge_material_d_id,
    panthelyfuras_quantity, panthelyfuras_oldal,
    duplungolas, szogvagas,
    materials(id, name, brand_id, length_mm, width_mm, brands(name))
  `)
  .eq('quote_id', id)
  .order('created_at', { ascending: true })
```

**Why Include Material Data?**
- Need `material.name` for táblásAnyag reconstruction
- Need `length_mm` and `width_mm` for format string
- Brand name is already included in `material.name`

**Response Structure:**

```typescript
{
  id: "uuid",
  quote_number: "Q-2025-004",
  status: "draft",
  customer_id: "uuid",
  discount_percent: 10,
  customer: {
    id: "uuid",
    name: "Customer Name",
    email: "email@example.com",
    mobile: "+36 30 123 4567",
    discount_percent: 10,
    billing_name: "Billing Name",
    billing_country: "Magyarország",
    billing_city: "Budapest",
    billing_postal_code: "1011",
    billing_street: "Fő utca",
    billing_house_number: "1",
    billing_tax_number: "12345678-1-23",
    billing_company_reg_number: "01-09-123456"
  },
  panels: [
    {
      id: "uuid",
      material_id: "uuid",
      width_mm: 1000,
      height_mm: 1000,
      quantity: 2,
      label: "Kitchen Cabinet",
      edge_material_a_id: "uuid-or-null",
      edge_material_b_id: "uuid-or-null",
      edge_material_c_id: "uuid-or-null",
      edge_material_d_id: "uuid-or-null",
      panthelyfuras_quantity: 4,
      panthelyfuras_oldal: "hosszú",
      duplungolas: true,
      szogvagas: false,
      materials: {
        id: "uuid",
        name: "F021 ST75 Szürke Triestino terrazzo",
        length_mm: 2800,
        width_mm: 2070,
        brands: { name: "Egger" }
      }
    }
  ],
  totals: {
    total_net: 96712,
    total_vat: 26112.24,
    total_gross: 122824.24,
    final_total_after_discount: 110541.82
  },
  created_at: "2025-01-06T...",
  updated_at: "2025-01-06T..."
}
```

**What's NOT Returned:**
- ❌ Pricing snapshots (`quote_materials_pricing`)
- ❌ Edge materials breakdown
- ❌ Services breakdown
- ❌ Board placements/optimization results

**Rationale:** These will be recalculated when user clicks "Optimalizálás".

---

### 3. Frontend State Management

**File:** `src/app/(dashboard)/opti/OptiClient.tsx`

**New Props Interface:**

```typescript
interface OptiClientProps {
  initialMaterials: Material[]
  initialCustomers: Customer[]
  initialEdgeMaterials: EdgeMaterial[]
  initialCuttingFee: any
  initialQuoteData?: any  // ← New optional prop
}
```

**New State Variables:**

```typescript
// Quote editing state
const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
const [isEditMode, setIsEditMode] = useState(false)
```

**Purpose:**
- `editingQuoteId`: Stores the UUID of the quote being edited
- `isEditMode`: Boolean flag to control UI behavior (button text, toast messages)

---

### 4. Quote Data Loading Hook

**Location:** Lines 440-508 in `OptiClient.tsx`

**Trigger:** When `initialQuoteData` prop is provided

**Dependencies:**
```typescript
useEffect(() => {
  // Runs when quote data is provided AND materials/edges are loaded
}, [initialQuoteData, materials, edgeMaterials, customers])
```

**Process Flow:**

#### Step 1: Set Edit Mode Flags

```typescript
setIsEditMode(true)
setEditingQuoteId(initialQuoteData.id)
// Do NOT set savedQuoteNumber here (only after successful save)
```

**Why not set `savedQuoteNumber`?**
- Would make button show "Frissítve: Q-2025-004" immediately
- Should only show after user saves changes
- Button should show "Árajánlat frissítése" on load

---

#### Step 2: Populate Customer Data

```typescript
if (initialQuoteData.customer) {
  const customer = initialQuoteData.customer
  
  // Find and set customer in dropdown
  const customerInList = customers.find(c => c.id === customer.id)
  if (customerInList) {
    setSelectedCustomer(customerInList)
  }
  
  // Populate all customer form fields
  setCustomerData({
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.mobile || '',
    discount: customer.discount_percent?.toString() || '0',
    billing_name: customer.billing_name || '',
    billing_country: customer.billing_country || 'Magyarország',
    billing_city: customer.billing_city || '',
    billing_postal_code: customer.billing_postal_code || '',
    billing_street: customer.billing_street || '',
    billing_house_number: customer.billing_house_number || '',
    billing_tax_number: customer.billing_tax_number || '',
    billing_company_reg_number: customer.billing_company_reg_number || ''
  })
}
```

**Why Set Both `selectedCustomer` AND `customerData`?**

- `selectedCustomer`: Populates the Autocomplete dropdown (shows selected customer)
- `customerData`: Populates all form fields (name, email, billing info)
- Both are needed for the form to display correctly

**Customer Soft Delete Handling:**
- We use soft delete on customers table
- If customer was soft-deleted, they won't be in `customers` array
- `customerInList` will be `null`
- But `customerData` will still populate (shows data in form)
- User can still edit and save (quote keeps reference to soft-deleted customer)

---

#### Step 3: Populate Panels

**Challenge:** Reconstruct the `táblásAnyag` format.

**Panel State Structure:**

```typescript
interface Panel {
  id: string
  táblásAnyag: string  // Format: "Material Name (width×lengthmm)"
  hosszúság: string
  szélesség: string
  darab: string
  jelölés: string
  élzárásA: string  // UUID
  élzárásB: string  // UUID
  élzárásC: string  // UUID
  élzárásD: string  // UUID
  pánthelyfúrás_mennyiség: number
  pánthelyfúrás_oldal: string
  duplungolás: boolean
  szögvágás: boolean
}
```

**Database Panel Structure:**

```typescript
{
  material_id: "uuid",
  width_mm: 1000,
  height_mm: 1000,
  quantity: 2,
  label: "Kitchen Cabinet",
  edge_material_a_id: "uuid-or-null",
  // ... etc
}
```

**Reconstruction Code:**

```typescript
const loadedPanels: Panel[] = initialQuoteData.panels.map((panel: any, index: number) => {
  // Find material in materials array
  const material = materials.find(m => m.id === panel.material_id)
  
  // Reconstruct táblásAnyag format
  const táblásAnyag = material 
    ? `${material.name} (${material.width_mm}×${material.length_mm}mm)`
    : 'Unknown Material'
  
  return {
    id: `panel-${Date.now()}-${index}`,
    táblásAnyag: táblásAnyag,
    hosszúság: panel.width_mm.toString(),
    szélesség: panel.height_mm.toString(),
    darab: panel.quantity.toString(),
    jelölés: panel.label || '',
    élzárás: '', // Not used in current implementation
    élzárásA: panel.edge_material_a_id || '',
    élzárásB: panel.edge_material_b_id || '',
    élzárásC: panel.edge_material_c_id || '',
    élzárásD: panel.edge_material_d_id || '',
    pánthelyfúrás_mennyiség: panel.panthelyfuras_quantity || 0,
    pánthelyfúrás_oldal: panel.panthelyfuras_oldal || '',
    duplungolás: panel.duplungolas || false,
    szögvágás: panel.szogvagas || false
  }
})

setAddedPanels(loadedPanels)
```

**Critical Detail: Material Name Format**

**WRONG Approach:**
```typescript
// Don't do this!
const brandName = panel.materials?.brands?.name || ''
const materialName = panel.materials?.name || ''
const fullName = `${brandName} ${materialName}` // ← Results in "Egger Egger F021 ST75..."
```

**CORRECT Approach:**
```typescript
// Do this!
const material = materials.find(m => m.id === panel.material_id)
const táblásAnyag = `${material.name} (${material.width_mm}×${material.length_mm}mm)`
// ← Results in "F021 ST75 Szürke Triestino terrazzo (2070×2800mm)"
```

**Why?**
- `material.name` in the materials array **already includes the brand name**
- It's the full display name used throughout the application
- Example: "F021 ST75 Szürke Triestino terrazzo" (NOT "Egger" + "F021 ST75...")

**Matching Logic in Optimization:**

The `optimize()` function later does this:
```typescript
const materialName = materialMatch[1].trim()  // From táblásAnyag string
const material = materials.find(m => 
  m.name === materialName &&  // ← Must match exactly
  m.width_mm === materialWidth && 
  m.length_mm === materialLength
)
```

If the name doesn't match, you get: **"Material not found in materials array"**

---

### 5. Button Text Logic

**Implementation:** Lines 2692-2705 in `OptiClient.tsx`

**Logic Tree:**

```typescript
{isSavingQuote ? (
  <>
    <CircularProgress size={20} sx={{ mr: 1 }} />
    {isEditMode ? 'Frissítés...' : 'Mentés...'}
  </>
) : savedQuoteNumber && isEditMode ? (
  `Frissítve: ${savedQuoteNumber}`
) : savedQuoteNumber ? (
  `Mentve: ${savedQuoteNumber}`
) : isEditMode ? (
  'Árajánlat frissítése'
) : (
  'Árajánlat mentése'
)}
```

**State Table:**

| Condition | `isEditMode` | `isSavingQuote` | `savedQuoteNumber` | Button Text |
|-----------|--------------|-----------------|-------------------|-------------|
| Loading new quote | false | false | null | "Árajánlat mentése" |
| Saving new quote | false | true | null | "Mentés..." |
| Saved new quote | false | false | "Q-2025-001" | "Mentve: Q-2025-001" |
| Loading edit mode | true | false | null | "Árajánlat frissítése" |
| Saving edit mode | true | true | null | "Frissítés..." |
| Saved edit mode | true | false | "Q-2025-004" | "Frissítve: Q-2025-004" |

---

### 6. Optimization Reset Logic

**Problem:** User loads quote, optimizes, sees "Frissítve: Q-2025-004", makes changes, re-optimizes, still sees "Frissítve".

**Solution:** Reset `savedQuoteNumber` when optimization runs.

**Code:** Line 1131 in `OptiClient.tsx`

```typescript
const optimize = async () => {
  // ... validation ...
  
  setIsOptimizing(true)
  setError(null)
  
  // Reset saved state when re-optimizing (user made changes)
  setSavedQuoteNumber(null)  // ← Reset here
  
  // ... rest of optimization logic ...
}
```

**Result:**
- User loads quote → Button: "Árajánlat frissítése" ✓
- User modifies panel → Clicks "Optimalizálás"
- Button resets to → "Árajánlat frissítése" ✓
- User clicks save → Button: "Frissítve: Q-2025-004" ✓

---

### 7. Save Function Updates

**Location:** Lines 1267-1459 in `OptiClient.tsx`

**Key Changes:**

#### A. Pass `editingQuoteId` to API

```typescript
body: JSON.stringify({
  quoteId: editingQuoteId, // ← null for new quote, UUID for editing
  customerData: customerPayload,
  panels: panelsToSave,
  optimizationResults: optimizationResult,
  quoteCalculations: quoteCalculationsPayload
})
```

#### B. Different Toast Messages

```typescript
if (isEditMode) {
  toast.success(`Árajánlat sikeresen frissítve: ${result.quoteNumber}`)
} else {
  toast.success(`Árajánlat sikeresen mentve: ${result.quoteNumber}`)
}
```

#### C. Cache Clearing

```typescript
// Clear cache after save
sessionStorage.removeItem('opti-panels')

// Refresh the page to clear any cached data
router.refresh()
```

**Why Clear Cache?**
- Session storage holds panels (might be stale)
- Router refresh re-fetches SSR data (gets fresh quote data if still on same URL)
- Ensures UI is in sync with database

---

### 8. API Update Endpoint

**File:** `src/app/api/quotes/route.ts`

**Update Logic (when `quoteId` is provided):**

```typescript
if (quoteId) {
  // Step 1: Delete old panels
  await supabaseServer
    .from('quote_panels')
    .delete()
    .eq('quote_id', quoteId)
  
  // Step 2: Delete old pricing (CASCADE deletes breakdowns)
  await supabaseServer
    .from('quote_materials_pricing')
    .delete()
    .eq('quote_id', quoteId)
  
  // Step 3: Update quote header
  const { data: updatedQuote } = await supabaseServer
    .from('quotes')
    .update(quoteData)
    .eq('id', quoteId)
    .select('id, quote_number')
    .single()
  
  finalQuoteNumber = updatedQuote.quote_number  // ← Store for response
  
  // Step 4: Re-insert panels (same as new quote)
  // Step 5: Re-insert pricing (same as new quote)
}
```

**Key Fix:**

**Before (Wrong):**
```typescript
return NextResponse.json({
  quoteNumber: quoteNumber  // ← Undefined when updating
})
```

**After (Correct):**
```typescript
let finalQuoteNumber = quoteNumber

if (quoteId) {
  finalQuoteNumber = updatedQuote.quote_number  // ← Store it
}

return NextResponse.json({
  quoteNumber: finalQuoteNumber  // ← Always has value
})
```

---

## Data Flow

### Loading an Existing Quote

```
1. USER NAVIGATION
   └─ User on /quotes page (future)
   └─ Clicks "Edit" button on quote Q-2025-004
   └─ Navigates to /opti?quote_id=69140d83-81f3-4570-bc13-fde535c91e1d

2. SERVER-SIDE (page.tsx)
   └─ Extract quote_id from searchParams
   └─ Fetch quote data: GET /api/quotes/69140d83-81f3-4570-bc13-fde535c91e1d
   └─ Fetch materials, customers, edges (parallel)
   └─ Pass all data to OptiClient as props

3. CLIENT-SIDE (OptiClient.tsx)
   └─ Component mounts
   └─ useEffect detects initialQuoteData
   └─ Set edit mode flags:
      ├─ isEditMode = true
      ├─ editingQuoteId = "69140d83..."
      └─ savedQuoteNumber = null (NOT set yet)
   └─ Populate customer data:
      ├─ setSelectedCustomer (for dropdown)
      └─ setCustomerData (for form fields)
   └─ Populate panels:
      ├─ Reconstruct táblásAnyag format
      ├─ Convert numbers to strings
      └─ setAddedPanels(loadedPanels)
   └─ Log: "Loaded X panels from quote"

4. UI STATE
   └─ Panels table shows loaded panels ✓
   └─ Customer form filled ✓
   └─ Billing accordion filled ✓
   └─ "Árajánlat" accordion EMPTY (no optimization yet)
   └─ Button shows "Árajánlat frissítése" ✓
   └─ Button is DISABLED (no optimization results)

5. USER INTERACTION
   └─ User reviews data
   └─ User modifies panels (optional)
   └─ User clicks "Optimalizálás"
   └─ Optimization runs
   └─ Results appear in accordions
   └─ Button shows "Árajánlat frissítése" (still)
   └─ Button is ENABLED

6. USER SAVES
   └─ User clicks "Árajánlat frissítése"
   └─ Button shows "Frissítés..." with spinner
   └─ API called with quoteId: "69140d83..."
   └─ API updates quote (DELETE + INSERT)
   └─ Response: { quoteNumber: "Q-2025-004" }
   └─ setSavedQuoteNumber("Q-2025-004")
   └─ Toast: "Árajánlat sikeresen frissítve: Q-2025-004"
   └─ Button: "Frissítve: Q-2025-004"
   └─ Clear cache + refresh page
```

---

### Modifying and Re-Optimizing

```
User loads quote → Panels loaded
    ↓
User adds another panel
    ↓
User clicks "Optimalizálás"
    ↓
setSavedQuoteNumber(null)  ← Reset button state
    ↓
Optimization runs with NEW panels (original + added)
    ↓
Button shows "Árajánlat frissítése" (not "Frissítve")
    ↓
User clicks "Árajánlat frissítése"
    ↓
API updates quote with ALL current panels
    ↓
Old panels deleted, new panels inserted
    ↓
Success!
```

---

## State Management

### State Variables Used

| Variable | Type | Purpose |
|----------|------|---------|
| `editingQuoteId` | `string \| null` | UUID of quote being edited (null for new quote) |
| `isEditMode` | `boolean` | Flag to control UI behavior (button text, messages) |
| `savedQuoteNumber` | `string \| null` | Quote number after save (for button display) |
| `isSavingQuote` | `boolean` | Loading state while saving |
| `selectedCustomer` | `Customer \| null` | Customer object for Autocomplete |
| `customerData` | `object` | Form data for all customer fields |
| `addedPanels` | `Panel[]` | Array of panels in table |

### State Transitions

**On Quote Load:**
```
editingQuoteId: null → "uuid"
isEditMode: false → true
savedQuoteNumber: null → null (stays null until save)
selectedCustomer: null → Customer object
customerData: empty → filled with quote data
addedPanels: [] → loaded panels
```

**On Optimization:**
```
savedQuoteNumber: any → null (reset)
optimizationResult: null → results
quoteResult: null → calculated quote
```

**On Save Success:**
```
savedQuoteNumber: null → "Q-2025-004"
isSavingQuote: true → false
```

**On Cache Clear:**
```
router.refresh() → Triggers SSR re-fetch
sessionStorage.removeItem() → Clears panel cache
```

---

## API Endpoints

### GET /api/quotes/[id]

**Purpose:** Fetch single quote with all necessary data for editing.

**Request:**
```
GET /api/quotes/69140d83-81f3-4570-bc13-fde535c91e1d
```

**Response (200 OK):**
```json
{
  "id": "69140d83-81f3-4570-bc13-fde535c91e1d",
  "quote_number": "Q-2025-004",
  "status": "draft",
  "customer_id": "customer-uuid",
  "discount_percent": 10,
  "customer": {
    "id": "customer-uuid",
    "name": "Test Customer",
    "email": "test@example.com",
    "mobile": "+36 30 123 4567",
    "discount_percent": 10,
    "billing_name": "Test Customer Ltd.",
    "billing_country": "Magyarország",
    "billing_city": "Budapest",
    "billing_postal_code": "1011",
    "billing_street": "Fő utca",
    "billing_house_number": "1",
    "billing_tax_number": "12345678-1-23",
    "billing_company_reg_number": "01-09-123456"
  },
  "panels": [
    {
      "id": "panel-uuid",
      "material_id": "material-uuid",
      "width_mm": 1000,
      "height_mm": 1000,
      "quantity": 2,
      "label": "Kitchen Cabinet",
      "edge_material_a_id": "edge-uuid",
      "edge_material_b_id": "edge-uuid",
      "edge_material_c_id": "edge-uuid",
      "edge_material_d_id": "edge-uuid",
      "panthelyfuras_quantity": 4,
      "panthelyfuras_oldal": "hosszú",
      "duplungolas": true,
      "szogvagas": false,
      "materials": {
        "id": "material-uuid",
        "name": "F021 ST75 Szürke Triestino terrazzo",
        "length_mm": 2800,
        "width_mm": 2070,
        "brands": { "name": "Egger" }
      }
    }
  ],
  "totals": {
    "total_net": 96712,
    "total_vat": 26112.24,
    "total_gross": 122824.24,
    "final_total_after_discount": 110541.82
  },
  "created_at": "2025-01-06T14:00:00Z",
  "updated_at": "2025-01-06T15:30:00Z"
}
```

**Error Responses:**

**404 Not Found:**
```json
{
  "error": "Quote not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch quote",
  "details": "..."
}
```

---

### POST /api/quotes (Update Mode)

**Purpose:** Update existing quote with new data.

**Request:**
```json
{
  "quoteId": "69140d83-81f3-4570-bc13-fde535c91e1d",  // ← Not null (edit mode)
  "customerData": { ... },
  "panels": [ ... ],
  "optimizationResults": { ... },
  "quoteCalculations": { ... }
}
```

**Process:**

1. **Validate Authentication** → Get user from cookies
2. **Validate Customer** → Use existing or create new
3. **Delete Old Data:**
   ```sql
   DELETE FROM quote_panels WHERE quote_id = '69140d83-...';
   DELETE FROM quote_materials_pricing WHERE quote_id = '69140d83-...';
   -- CASCADE deletes edge_materials_breakdown and services_breakdown
   ```
4. **Update Quote:**
   ```sql
   UPDATE quotes 
   SET customer_id = '...', total_net = ..., updated_at = NOW()
   WHERE id = '69140d83-...';
   ```
5. **Re-Insert Panels** (same as new quote)
6. **Re-Insert Pricing** (same as new quote)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Árajánlat sikeresen mentve",
  "quoteId": "69140d83-81f3-4570-bc13-fde535c91e1d",
  "quoteNumber": "Q-2025-004"
}
```

**Key Fix:**
- `finalQuoteNumber = updatedQuote.quote_number` ensures response contains the number
- Previously was `undefined` causing toast to show "...frissítve: undefined"

---

## User Experience

### Scenario 1: Edit Existing Quote

**Step-by-Step:**

1. **User clicks Edit on /quotes page** (future feature)
   - Redirects to `/opti?quote_id=69140d83-81f3-4570-bc13-fde535c91e1d`

2. **Page loads with data**
   - 🔄 Loading spinner appears briefly
   - ✅ Page renders with:
     - Customer: "Test Customer" selected in dropdown
     - Email: "test@example.com"
     - Mobile: "+36 30 123 4567"
     - Discount: "10"
     - Billing fields filled
     - 2 panels in "Hozzáadott panelek" table:
       - Panel 1: 1000×1000, qty: 2, Kitchen Cabinet
       - Panel 2: 800×600, qty: 1, Office Desk
     - Edge materials selected on each panel
     - Services checked (Pánthelyfúrás: 4, Duplungolás: Yes)
   - ❌ "Árajánlat" accordion NOT shown (empty)
   - 🔘 "Optimalizálás" button: Enabled, Yellow
   - 🔘 "Árajánlat frissítése" button: Hidden (no optimization yet)

3. **User reviews data**
   - Checks panels are correct
   - Checks customer info
   - Decides to add one more panel

4. **User adds new panel**
   - Fills form: 500×500, qty: 3
   - Selects material, edges
   - Clicks "Hozzáadás"
   - New panel appears in table (total: 3 panels now)

5. **User clicks "Optimalizálás"**
   - Button shows: 🔄 "Optimalizálás..." with spinner
   - `setSavedQuoteNumber(null)` ← Reset
   - Optimization runs with ALL 3 panels
   - Results appear:
     - Panel visualization accordion
     - "Árajánlat" accordion with updated pricing
   - 🔘 "Optimalizálás" button: Green, "Optimalizálás"
   - 🔘 "Árajánlat frissítése" button: **Appears**, Blue, Enabled

6. **User reviews new quote**
   - Checks pricing is correct
   - Verifies all panels placed
   - Satisfied with results

7. **User clicks "Árajánlat frissítése"**
   - Button shows: 🔄 "Frissítés..." with spinner
   - API called with `quoteId: "69140d83..."`
   - Old data deleted, new data inserted
   - Response: `{ quoteNumber: "Q-2025-004" }`
   - Toast appears: ✅ "Árajánlat sikeresen frissítve: Q-2025-004"
   - Button changes to: ✅ "Frissítve: Q-2025-004"
   - Cache cleared
   - Page refreshes (re-fetches from server)

8. **After refresh**
   - URL still: `/opti?quote_id=69140d83...`
   - Data reloaded from database
   - Shows updated 3 panels
   - Button: "Árajánlat frissítése"
   - User can continue editing or navigate away

---

### Scenario 2: Load Quote, Don't Modify, Just Re-save

**Flow:**

1. Load quote → `/opti?quote_id=xxx`
2. Data populated
3. Click "Optimalizálás" (no modifications)
4. Click "Árajánlat frissítése"
5. Quote updated with same data
6. `updated_at` timestamp changes
7. No other changes in database

**Use Case:** User wants to refresh optimization results with current material prices.

---

### Scenario 3: Load Quote with Deleted Customer

**Problem:** Quote references customer, but customer was soft-deleted.

**Behavior:**

1. Load quote
2. API returns customer data (soft-deleted records still accessible via FK)
3. `customerInList` = `null` (customer not in active customers array)
4. `selectedCustomer` = `null` (dropdown empty)
5. `customerData` = filled with quote customer data
6. Form shows customer name and all fields
7. User can still edit and save
8. Quote keeps reference to soft-deleted customer

**Alternative:** Could show warning "This customer has been deleted" but still allow editing.

---

## Edge Cases & Error Handling

### Edge Case 1: Invalid Quote ID

**Scenario:** User navigates to `/opti?quote_id=invalid-uuid`

**Behavior:**
```
1. Server fetches /api/quotes/invalid-uuid
2. API returns 404 or error
3. page.tsx catches error
4. quoteData = null
5. OptiClient renders in new quote mode
6. No data populated, empty form
```

**User sees:** Normal opti page (no error, just empty)

**Improvement:** Could add error message "Quote not found" alert.

---

### Edge Case 2: Quote ID Exists But Soft-Deleted

**Scenario:** Quote has `deleted_at` timestamp.

**Behavior:**
```
1. Server fetches /api/quotes/xxx
2. SQL filter: .is('deleted_at', null)
3. Returns no rows (PGRST116 error)
4. API returns 404
5. quoteData = null
6. Renders as new quote
```

**Protection:** Soft-deleted quotes cannot be loaded.

---

### Edge Case 3: Material No Longer Exists

**Scenario:** Panel references material that was deleted or doesn't exist.

**Behavior:**
```
1. Panel loads: material_id = "uuid-of-deleted-material"
2. materials.find(m => m.id === panel.material_id) → undefined
3. táblásAnyag = "Unknown Material"
4. Panel loads with "Unknown Material"
5. User clicks "Optimalizálás"
6. Optimization tries to find material
7. materialMatch fails
8. Console log: "Material not found in materials array"
9. Material skipped from optimization
```

**Issue:** Panel exists but can't be optimized.

**Solution:** Should show warning "Some materials are no longer available".

---

### Edge Case 4: Edge Material No Longer Exists

**Scenario:** Panel has `edge_material_a_id` that was deleted.

**Behavior:**
```
1. Panel loads with edge_material_a_id = "uuid-of-deleted-edge"
2. Edge selector tries to display it
3. Edge material not in edgeMaterials array
4. Shows empty or error in dropdown
```

**Impact:** Visual issue, doesn't break functionality.

**Solution:** Could filter out null/invalid edge IDs when loading.

---

## Cache Management

### Session Storage

**Storage Key:** `opti-panels`

**Content:** JSON string of `addedPanels` array

**Lifecycle:**

**Save to cache:**
```typescript
useEffect(() => {
  if (addedPanels.length > 0) {
    sessionStorage.setItem('opti-panels', JSON.stringify(addedPanels))
  } else {
    sessionStorage.removeItem('opti-panels')
  }
}, [addedPanels])
```

**Load from cache (new quote mode):**
```typescript
useEffect(() => {
  const savedPanels = sessionStorage.getItem('opti-panels')
  if (savedPanels) {
    setAddedPanels(JSON.parse(savedPanels))
  }
}, [])
```

**Load from database (edit mode):**
```typescript
useEffect(() => {
  if (initialQuoteData) {
    const loadedPanels = initialQuoteData.panels.map(...)
    setAddedPanels(loadedPanels)  // Overwrites session storage
  }
}, [initialQuoteData])
```

**Clear after save:**
```typescript
sessionStorage.removeItem('opti-panels')
router.refresh()
```

**Potential Conflict:**

If user:
1. Loads quote A → Panels stored in session
2. Navigates to `/opti` (new quote) → Loads panels from session (quote A's panels!)
3. Creates new quote with quote A's panels

**Solution:** Session storage is cleared after save, so this only happens if user manually navigates without saving.

---

### Router Cache

**Next.js 15 Caching:**

Next.js caches server-side fetched data by default. When editing a quote, we need fresh data.

**Solutions:**

1. **Fetch with `no-store`:**
```typescript
fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' })
```

2. **Router refresh after save:**
```typescript
router.refresh()
```
- Re-runs server component
- Re-fetches all SSR data
- Updates props passed to client component

---

## Testing Guide

### Test 1: Load and View Quote

**Steps:**
1. Create a quote first (Q-2025-001)
2. Copy the quote UUID from database
3. Navigate to `/opti?quote_id=<uuid>`

**Expected:**
- ✅ Page loads successfully
- ✅ Customer dropdown shows selected customer
- ✅ All customer fields filled
- ✅ Panels table has all panels with correct data
- ✅ Edge materials shown in dropdowns
- ✅ Services checkboxes match saved values
- ✅ "Árajánlat" accordion is empty
- ✅ "Optimalizálás" button is enabled
- ✅ "Árajánlat frissítése" button is hidden

---

### Test 2: Edit Quote Without Changes

**Steps:**
1. Load quote (from Test 1)
2. Don't modify anything
3. Click "Optimalizálás"
4. Click "Árajánlat frissítése"

**Expected:**
- ✅ Optimization runs successfully
- ✅ Button shows "Árajánlat frissítése"
- ✅ Save succeeds
- ✅ Toast: "Árajánlat sikeresen frissítve: Q-2025-001"
- ✅ Button: "Frissítve: Q-2025-001"
- ✅ Database `updated_at` timestamp changes
- ✅ Database `updated_at` is newer than `created_at`

**SQL Verification:**
```sql
SELECT quote_number, created_at, updated_at 
FROM quotes 
WHERE id = 'uuid';

-- updated_at should be newer than created_at
```

---

### Test 3: Edit Quote - Add Panel

**Steps:**
1. Load quote with 1 panel
2. Add second panel (500×500, qty: 2)
3. Click "Optimalizálás"
4. Click "Árajánlat frissítése"

**Expected:**
- ✅ Optimization includes both panels
- ✅ Save succeeds
- ✅ Database has 2 panel rows (old deleted, both re-inserted)

**SQL Verification:**
```sql
SELECT COUNT(*) FROM quote_panels WHERE quote_id = 'uuid';
-- Should return 2
```

---

### Test 4: Edit Quote - Remove Panel

**Steps:**
1. Load quote with 2 panels
2. Delete one panel from table
3. Click "Optimalizálás"
4. Click "Árajánlat frissítése"

**Expected:**
- ✅ Optimization uses only remaining panel
- ✅ Save succeeds
- ✅ Database has 1 panel row

**SQL Verification:**
```sql
SELECT COUNT(*) FROM quote_panels WHERE quote_id = 'uuid';
-- Should return 1
```

---

### Test 5: Edit Quote - Change Customer

**Steps:**
1. Load quote for "Customer A"
2. Change customer dropdown to "Customer B"
3. Click "Optimalizálás"
4. Click "Árajánlat frissítése"

**Expected:**
- ✅ Quote now references Customer B
- ✅ `customer_id` in database updated

**SQL Verification:**
```sql
SELECT q.quote_number, c.name 
FROM quotes q
JOIN customers c ON q.customer_id = c.id
WHERE q.id = 'uuid';

-- Should show Customer B's name
```

---

### Test 6: Button State Changes

**Steps:**
1. Load quote
2. Verify button: "Árajánlat frissítése"
3. Click "Optimalizálás"
4. Verify button still: "Árajánlat frissítése"
5. Make a small change (change panel qty)
6. Click "Optimalizálás" again
7. Verify button resets to: "Árajánlat frissítése" (not "Frissítve")
8. Click "Árajánlat frissítése"
9. Verify button: "Frissítve: Q-2025-XXX"

**Expected:** Button text changes correctly at each step.

---

### Test 7: Quote Number Preservation

**Steps:**
1. Create quote Q-2025-001
2. Edit and save 3 times
3. Check database

**Expected:**
- ✅ Quote number stays Q-2025-001
- ✅ Only `updated_at` changes
- ✅ Quote ID stays the same

**SQL Verification:**
```sql
SELECT quote_number, created_at, updated_at 
FROM quotes 
WHERE quote_number = 'Q-2025-001';

-- updated_at should be much newer than created_at
-- But quote_number unchanged
```

---

### Test 8: Cache Clearing

**Steps:**
1. Load quote
2. Click "Optimalizálás"
3. Click "Árajánlat frissítése"
4. Wait for page refresh
5. Open browser DevTools → Application → Session Storage
6. Check for `opti-panels` key

**Expected:**
- ✅ `opti-panels` key is removed
- ✅ Page has refreshed (check network tab)
- ✅ Data is reloaded from server

---

## Troubleshooting

### Issue: "Material not found in materials array"

**Symptom:** Console error when clicking "Optimalizálás" in edit mode.

**Cause:** The `táblásAnyag` format doesn't match what optimization expects.

**Debug Steps:**

1. **Check táblásAnyag value:**
```typescript
console.log('Panel táblásAnyag:', panel.táblásAnyag)
// Should be: "F021 ST75 Szürke Triestino terrazzo (2070×2800mm)"
```

2. **Check material.name in array:**
```typescript
console.log('Material names:', materials.map(m => m.name))
// Should include: "F021 ST75 Szürke Triestino terrazzo"
```

3. **Check extraction:**
```typescript
const materialMatch = panel.táblásAnyag.match(/^(.+?)\s*\((\d+)×(\d+)mm\)$/)
console.log('Extracted name:', materialMatch[1])
// Should be: "F021 ST75 Szürke Triestino terrazzo"
```

4. **Check find logic:**
```typescript
const material = materials.find(m => 
  m.name === materialName &&  // ← Must match exactly
  m.width_mm === materialWidth && 
  m.length_mm === materialLength
)
console.log('Found material:', material)
```

**Common Causes:**
- Brand name duplicated: "Egger Egger F021..." ← Wrong
- Missing brand name: "F021..." when should be "Egger F021..." ← Wrong
- Extra spaces or formatting

**Fix:** Use `material.name` from materials array directly (see line 481).

---

### Issue: Button Shows "Frissítve" Immediately on Load

**Symptom:** When navigating to `/opti?quote_id=xxx`, button shows "Frissítve: Q-2025-004" before user does anything.

**Cause:** `setSavedQuoteNumber(initialQuoteData.quote_number)` was called in loading useEffect.

**Fix:** Remove that line. Only set `savedQuoteNumber` AFTER successful save (line 1437).

---

### Issue: Toast Shows "undefined"

**Symptom:** After clicking "Árajánlat frissítése", toast shows "...frissítve: undefined".

**Cause:** API was not returning `quoteNumber` in response for update mode.

**Root Cause:**
```typescript
// In API route
let quoteNumber = body.quoteNumber  // Only set for new quotes

if (quoteId) {
  // Update path
  const { data: updatedQuote } = await ... .update() ...
  // quoteNumber variable NOT updated ← Bug
}

return NextResponse.json({
  quoteNumber: quoteNumber  // ← Undefined for updates
})
```

**Fix:**
```typescript
let finalQuoteNumber = quoteNumber

if (quoteId) {
  const { data: updatedQuote } = await ... .update() ...
  finalQuoteNumber = updatedQuote.quote_number  // ← Store it
}

return NextResponse.json({
  quoteNumber: finalQuoteNumber  // ← Always has value
})
```

---

### Issue: Panels Not Cleared from Session Storage

**Symptom:** After editing quote, old panels appear when creating new quote.

**Cause:** Session storage not cleared after save.

**Fix:** Added `sessionStorage.removeItem('opti-panels')` after save (line 1447).

---

## Code Reference

### Key Code Sections

#### 1. Quote Loading Hook (OptiClient.tsx:440-510)

```typescript
useEffect(() => {
  if (initialQuoteData && materials.length > 0 && edgeMaterials.length > 0) {
    console.log('Loading quote for editing:', initialQuoteData.quote_number)
    
    setIsEditMode(true)
    setEditingQuoteId(initialQuoteData.id)
    // Don't set savedQuoteNumber here
    
    // Populate customer...
    // Populate panels...
  }
}, [initialQuoteData, materials, edgeMaterials, customers])
```

**Critical:** Don't set `savedQuoteNumber` during load, only after save.

---

#### 2. Panel Reconstruction (OptiClient.tsx:477-502)

```typescript
const loadedPanels: Panel[] = initialQuoteData.panels.map((panel: any, index: number) => {
  const material = materials.find(m => m.id === panel.material_id)
  const táblásAnyag = material 
    ? `${material.name} (${material.width_mm}×${material.length_mm}mm)`
    : 'Unknown Material'
  
  return {
    id: `panel-${Date.now()}-${index}`,
    táblásAnyag: táblásAnyag,
    hosszúság: panel.width_mm.toString(),
    szélesség: panel.height_mm.toString(),
    darab: panel.quantity.toString(),
    jelölés: panel.label || '',
    élzárás: '',
    élzárásA: panel.edge_material_a_id || '',
    élzárásB: panel.edge_material_b_id || '',
    élzárásC: panel.edge_material_c_id || '',
    élzárásD: panel.edge_material_d_id || '',
    pánthelyfúrás_mennyiség: panel.panthelyfuras_quantity || 0,
    pánthelyfúrás_oldal: panel.panthelyfuras_oldal || '',
    duplungolás: panel.duplungolas || false,
    szögvágás: panel.szogvagas || false
  }
})

setAddedPanels(loadedPanels)
```

**Key:** Use `material.name` directly (already includes brand).

---

#### 3. Optimization Reset (OptiClient.tsx:1131)

```typescript
const optimize = async () => {
  // ... validation ...
  
  setIsOptimizing(true)
  setError(null)
  
  // Reset saved state when re-optimizing (user made changes)
  setSavedQuoteNumber(null)  // ← Important!
  
  // ... optimization logic ...
}
```

**Why?** Ensures button shows "Árajánlat frissítése" after re-optimization, not "Frissítve".

---

#### 4. Button Text Logic (OptiClient.tsx:2692-2705)

```typescript
{isSavingQuote ? (
  <>
    <CircularProgress size={20} sx={{ mr: 1 }} />
    {isEditMode ? 'Frissítés...' : 'Mentés...'}
  </>
) : savedQuoteNumber && isEditMode ? (
  `Frissítve: ${savedQuoteNumber}`
) : savedQuoteNumber ? (
  `Mentve: ${savedQuoteNumber}`
) : isEditMode ? (
  'Árajánlat frissítése'
) : (
  'Árajánlat mentése'
)}
```

**Logic Priority:**
1. Saving? → Show spinner + "Frissítés..." or "Mentés..."
2. Saved + Edit mode? → "Frissítve: Q-2025-XXX"
3. Saved + New mode? → "Mentve: Q-2025-XXX"
4. Not saved + Edit mode? → "Árajánlat frissítése"
5. Not saved + New mode? → "Árajánlat mentése"

---

#### 5. Cache Clearing (OptiClient.tsx:1446-1450)

```typescript
// Clear cache after save
sessionStorage.removeItem('opti-panels')

// Refresh the page to clear any cached data
router.refresh()
```

**Order Important:**
1. First clear session storage
2. Then refresh router (re-runs SSR)
3. Component re-mounts with fresh data

---

#### 6. API Response Fix (route.ts:176-217)

```typescript
let finalQuoteId = quoteId
let finalQuoteNumber = quoteNumber  // ← Declare here

if (quoteId) {
  // Update existing quote
  const { data: updatedQuote } = await supabaseServer
    .from('quotes')
    .update(quoteData)
    .eq('id', quoteId)
    .select('id, quote_number')
    .single()
  
  finalQuoteNumber = updatedQuote.quote_number  // ← Update here
} else {
  // Create new quote
  const { data: newQuote } = await ...
  finalQuoteNumber = newQuote.quote_number  // ← Set here
}

return NextResponse.json({
  quoteNumber: finalQuoteNumber  // ← Use here (always defined)
})
```

---

## Database Queries

### Verify Quote Was Updated

```sql
-- Check quote header
SELECT 
  quote_number,
  status,
  total_net,
  total_vat,
  total_gross,
  created_at,
  updated_at,
  updated_at - created_at AS time_since_created
FROM quotes 
WHERE id = '69140d83-81f3-4570-bc13-fde535c91e1d';

-- updated_at should be newer after edit
```

---

### Verify Panels Were Replaced

```sql
-- Check panel count and details
SELECT 
  qp.width_mm,
  qp.height_mm,
  qp.quantity,
  qp.label,
  m.name AS material_name,
  qp.created_at
FROM quote_panels qp
JOIN materials m ON qp.material_id = m.id
WHERE qp.quote_id = '69140d83-81f3-4570-bc13-fde535c91e1d'
ORDER BY qp.created_at;

-- All panels should have created_at = quote's updated_at
-- (Because they were deleted and re-inserted)
```

---

### Verify Pricing Was Replaced

```sql
-- Check pricing timestamps
SELECT 
  material_name,
  boards_used,
  total_gross,
  created_at
FROM quote_materials_pricing
WHERE quote_id = '69140d83-81f3-4570-bc13-fde535c91e1d';

-- All rows should have created_at = quote's updated_at
```

---

## Performance Considerations

### SSR Fetch Optimization

**Current Implementation:**
```typescript
// Fetch quote data
const response = await fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' })

// Fetch other data in parallel
const [materials, customers, edgeMaterials, cuttingFee] = await Promise.all([...])
```

**Not Parallel:** Quote fetch is sequential, then other fetches are parallel.

**Potential Optimization:**
```typescript
const [quoteResponse, materials, customers, edgeMaterials, cuttingFee] = await Promise.all([
  fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' }),
  getAllMaterials(),
  getAllCustomers(),
  getAllEdgeMaterials(),
  getCuttingFee()
])

const quoteData = await quoteResponse.json()
```

**Benefit:** ~100-200ms faster page load.

---

### Database Query Optimization

**Current:** 2 queries per quote load
1. SELECT from quotes (with customer JOIN)
2. SELECT from quote_panels (with materials and brands JOINs)

**Already Optimal:** JOINs are indexed, queries are fast.

---

## Security Considerations

### Access Control

**Current:** No access control beyond page-level permission.

**Anyone with `/opti` access can:**
- View any quote
- Edit any quote
- Update any quote

**Potential Risks:**

1. **User A edits User B's quote**
   - No audit trail of who modified what
   - Could cause confusion

2. **Concurrent edits**
   - User A and User B edit same quote simultaneously
   - Last save wins (data could be lost)

**Recommendations for Future:**

1. **Add created_by check:**
```typescript
// Only allow editing own quotes
const { data: quote } = await supabaseServer
  .from('quotes')
  .select('*')
  .eq('id', quoteId)
  .eq('created_by', user.id)  // ← Check ownership
  .single()
```

2. **Add optimistic locking:**
```typescript
// Check if quote was modified since user loaded it
.eq('updated_at', originalUpdatedAt)
// If not found → Someone else modified it
```

3. **Add edit history table:**
```sql
CREATE TABLE quote_edit_history (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  edited_by UUID REFERENCES auth.users(id),
  changes JSONB,  -- What changed
  edited_at TIMESTAMPTZ
);
```

---

## Button State Machine

### States & Transitions

```
State 1: Initial Load (Edit Mode)
  - isEditMode: true
  - editingQuoteId: "uuid"
  - savedQuoteNumber: null
  - isSavingQuote: false
  - optimizationResult: null
  - quoteResult: null
  → Button: HIDDEN (no optimization yet)

State 2: After Optimization
  - isEditMode: true
  - editingQuoteId: "uuid"
  - savedQuoteNumber: null
  - isSavingQuote: false
  - optimizationResult: { ... }
  - quoteResult: { ... }
  → Button: VISIBLE, "Árajánlat frissítése"

State 3: Saving
  - isEditMode: true
  - savedQuoteNumber: null
  - isSavingQuote: true
  → Button: "Frissítés..." with spinner

State 4: Saved Successfully
  - isEditMode: true
  - savedQuoteNumber: "Q-2025-004"
  - isSavingQuote: false
  → Button: "Frissítve: Q-2025-004"
  → Cache cleared, page refreshes
  → Returns to State 1

State 5: User Re-Optimizes
  - User changes panel
  - Clicks "Optimalizálás"
  - setSavedQuoteNumber(null) ← Reset
  → Transitions back to State 2
```

---

## Comparison: New vs Edit Mode

| Aspect | New Quote Mode | Edit Mode |
|--------|---------------|-----------|
| URL | `/opti` | `/opti?quote_id=xxx` |
| Initial panels | Empty (or session storage) | Loaded from database |
| Initial customer | Empty | Loaded from database |
| `isEditMode` | `false` | `true` |
| `editingQuoteId` | `null` | `"uuid"` |
| Button text (before save) | "Árajánlat mentése" | "Árajánlat frissítése" |
| Button text (saving) | "Mentés..." | "Frissítés..." |
| Button text (after save) | "Mentve: Q-2025-XXX" | "Frissítve: Q-2025-XXX" |
| Toast (success) | "sikeresen mentve" | "sikeresen frissítve" |
| API request | `quoteId: null` | `quoteId: "uuid"` |
| Database action | INSERT new quote | UPDATE + DELETE/INSERT |
| Quote number | Generated (Q-2025-005) | Preserved (Q-2025-004) |
| After save | URL unchanged (`/opti`) | URL unchanged (`/opti?quote_id=xxx`) |

---

## Future Enhancements

### 1. Edit History / Audit Trail

**Feature:** Track who modified what and when.

**Implementation:**
- New table: `quote_edit_history`
- Record each save with user, timestamp, changes
- Display on quote detail page

---

### 2. Version History

**Feature:** Keep snapshots of previous versions.

**Implementation:**
- Don't DELETE old panels, mark as inactive
- Add `version` field to panels
- Allow viewing historical versions

---

### 3. Concurrent Edit Protection

**Feature:** Prevent two users from editing same quote simultaneously.

**Implementation:**
- Add `locked_by` and `locked_at` fields to quotes
- Lock quote when user opens for edit
- Auto-unlock after 30 minutes or when user saves/cancels

---

### 4. Change Comparison

**Feature:** Show what changed compared to original quote.

**Implementation:**
- Fetch original quote data
- Compare with current state
- Highlight differences in UI
- "3 panels changed, 1 customer field modified"

---

### 5. Breadcrumb Navigation

**Feature:** Show quote context in breadcrumb.

**Current:**
```
Home > Opti
```

**Enhanced:**
```
Home > Quotes > Q-2025-004 > Edit
```

---

## Integration with Future Features

### /quotes Management Page

**When implemented:**

```typescript
// On quotes list page
<Button 
  onClick={() => router.push(`/opti?quote_id=${quote.id}`)}
>
  Szerkesztés
</Button>
```

**Seamless integration** - just navigate to URL with parameter.

---

### PDF Export

**Quote editing affects PDF:**

- PDF should show `updated_at` timestamp
- PDF should indicate "Last modified: 2025-01-06 15:30"
- PDF version number could increment (v1, v2, v3)

---

### Order Conversion

**When converting quote to order:**

- Check if quote has pending edits
- Lock quote after conversion
- Prevent further edits (status: "in_production")

---

## Summary

The quote editing functionality is now **fully implemented** with:

✅ URL-based quote loading (`/opti?quote_id=xxx`)  
✅ SSR data fetching for performance  
✅ Complete customer and panel data restoration  
✅ Proper button text for edit mode ("Árajánlat frissítése")  
✅ State reset on re-optimization  
✅ Cache clearing after save  
✅ Quote number preservation on update  
✅ Different toast messages for create vs update  
✅ Router refresh for data synchronization  

**Total Changes:**
- 1 new API endpoint (`GET /api/quotes/[id]`)
- SSR enhancement in `page.tsx`
- Quote loading hook in `OptiClient.tsx` (~70 lines)
- Button logic updates
- Cache management

**Next Steps:**
- Implement `/quotes` management page
- Add bulk operations
- Add status workflow UI
- Add PDF export

---

**End of Documentation**


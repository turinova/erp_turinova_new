# Quote System Implementation Documentation

**Date:** 2025-01-06  
**Feature:** Complete Quote Saving & Management System  
**Status:** ✅ Implemented & Tested

---

## Overview

This document provides comprehensive documentation for the quote/proposal saving system implemented on the `/opti` page. The system allows users to save optimization results with complete customer data, panel specifications, and pricing calculations as formal quotes that can be referenced, managed, and potentially converted to orders in the future.

---

## Table of Contents

1. [Business Requirements](#business-requirements)
2. [Database Schema](#database-schema)
3. [Architecture](#architecture)
4. [Implementation Details](#implementation-details)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Data Flow](#data-flow)
8. [Testing](#testing)
9. [Future Enhancements](#future-enhancements)

---

## Business Requirements

### Core Features

1. **Quote Saving**
   - Save complete optimization results as formal quotes
   - Auto-generate unique quote numbers (format: Q-YYYY-NNN)
   - Store customer data, panels, pricing, and calculations

2. **Customer Auto-Creation**
   - If user types a new customer name (not in dropdown), auto-create customer
   - Use tenant company email as default for new customers
   - Store all customer billing information from the form

3. **Complete Data Snapshot**
   - Store ALL panel data (dimensions, edges, services)
   - Store complete pricing calculations (materials, edges, cutting, services)
   - Store pricing parameters (price_per_sqm, VAT, usage_limit, waste_multi)
   - Store board specifications and optimization results

4. **Quote Status Workflow**
   - Draft → Accepted → In Production → Done → Rejected
   - Initial status: Draft
   - Status can be changed later in quote management

5. **Quote Editing**
   - Quotes can be edited after saving
   - Editing deletes old data and saves new version
   - Quote ID and number remain the same

---

## Database Schema

### 1. `quotes` Table (Main Quote)

```sql
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_number VARCHAR(50) NOT NULL UNIQUE,
  status quote_status NOT NULL DEFAULT 'draft',
  
  -- Grand totals
  total_net NUMERIC(12,2) NOT NULL,
  total_vat NUMERIC(12,2) NOT NULL,
  total_gross NUMERIC(12,2) NOT NULL,
  
  -- Discount snapshot from customer at time of quote
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  final_total_after_discount NUMERIC(12,2) NOT NULL,
  
  -- Audit fields
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);
```

**Purpose:** Main quote record with totals, customer reference, status, and audit trail.

**Key Fields:**
- `quote_number`: Auto-generated format Q-2025-001, Q-2025-002, etc.
- `status`: ENUM ('draft', 'accepted', 'in_production', 'done', 'rejected')
- `discount_percent`: Snapshot of customer's discount at time of quote creation
- `final_total_after_discount`: Grand total after applying discount
- `created_by`: User who created the quote (for audit trail)

---

### 2. `quote_panels` Table (Panel Specifications)

```sql
CREATE TABLE public.quote_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  
  -- Panel specifications
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  label VARCHAR(255) NULL, -- Customer reference label (Jelölés)
  
  -- Edge materials (nullable)
  edge_material_a_id UUID NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  edge_material_b_id UUID NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  edge_material_c_id UUID NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  edge_material_d_id UUID NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  
  -- Additional services
  panthelyfuras_quantity INTEGER NOT NULL DEFAULT 0,
  panthelyfuras_oldal VARCHAR(50) NULL, -- 'hosszú' or 'rövid'
  duplungolas BOOLEAN NOT NULL DEFAULT FALSE,
  szogvagas BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose:** Store every panel added to the quote with all specifications.

**Key Points:**
- Each row represents one panel entry (width × height × quantity)
- Stores edge material selections for all 4 sides (A, B, C, D)
- Stores additional services (hinge holes, grooving, angle cutting)
- `ON DELETE CASCADE`: When quote is deleted, panels are auto-deleted
- `grain_direction` is NOT stored here (it's a material property, stored in `quote_materials_pricing`)

---

### 3. `quote_materials_pricing` Table (Pricing Snapshot)

```sql
CREATE TABLE public.quote_materials_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  
  -- Material snapshots (at time of quote)
  material_name VARCHAR(255) NOT NULL,
  board_width_mm INTEGER NOT NULL,
  board_length_mm INTEGER NOT NULL,
  thickness_mm INTEGER NOT NULL,
  grain_direction BOOLEAN NOT NULL,
  
  -- Stock & optimization results
  on_stock BOOLEAN NOT NULL,
  boards_used INTEGER NOT NULL,
  usage_percentage NUMERIC(5,2) NOT NULL,
  pricing_method VARCHAR(20) NOT NULL, -- 'panel_area' or 'full_board'
  charged_sqm NUMERIC(10,4) NULL, -- ONLY for on_stock=true with panel_area pricing
  
  -- Pricing snapshots (at time of quote)
  price_per_sqm NUMERIC(10,2) NOT NULL,
  vat_rate NUMERIC(5,4) NOT NULL, -- e.g., 0.27 for 27%
  currency VARCHAR(10) NOT NULL, -- e.g., 'HUF'
  usage_limit NUMERIC(5,4) NOT NULL, -- e.g., 0.65
  waste_multi NUMERIC(5,2) NOT NULL, -- e.g., 1.2
  
  -- Material cost breakdown
  material_net NUMERIC(12,2) NOT NULL,
  material_vat NUMERIC(12,2) NOT NULL,
  material_gross NUMERIC(12,2) NOT NULL,
  
  -- Edge materials cost breakdown
  edge_materials_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  edge_materials_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  edge_materials_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Cutting cost breakdown
  cutting_length_m NUMERIC(10,2) NOT NULL,
  cutting_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutting_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  cutting_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Services cost breakdown
  services_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  services_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  services_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Total for this material
  total_net NUMERIC(12,2) NOT NULL,
  total_vat NUMERIC(12,2) NOT NULL,
  total_gross NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose:** Complete pricing snapshot for each material used in the quote.

**Why Snapshots?**
- Material prices may change in the future
- Quote must show the **original prices** used when the quote was created
- Allows exact reproduction of the "Árajánlat" accordion display

**Key Fields:**
- **Material Snapshots**: Name, dimensions, grain direction (frozen at time of quote)
- **Pricing Snapshots**: price_per_sqm, VAT rate, currency, usage_limit, waste_multi (frozen)
- **charged_sqm**: For `on_stock=true` materials, stores the sum of (panel area × waste_multiplier)
  - This is what the customer is actually charged for (e.g., "2.45m² × 1.2 = 2.94m²")
  - NULL for `on_stock=false` (they pay for full boards)
- **pricing_method**: Either `panel_area` or `full_board`
- **Cost Breakdowns**: Separate net/vat/gross for materials, edges, cutting, services

---

### 4. `quote_edge_materials_breakdown` Table

```sql
CREATE TABLE public.quote_edge_materials_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_materials_pricing_id UUID NOT NULL REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE,
  edge_material_id UUID NOT NULL REFERENCES public.edge_materials(id) ON DELETE RESTRICT,
  
  -- Edge material snapshot
  edge_material_name VARCHAR(255) NOT NULL,
  
  -- Calculation details
  total_length_m NUMERIC(10,2) NOT NULL,
  price_per_m NUMERIC(10,2) NOT NULL, -- snapshot
  
  -- Cost breakdown
  net_price NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  gross_price NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose:** Detailed breakdown of edge material costs per material.

**Relationship:** One `quote_materials_pricing` can have multiple edge materials (e.g., ABS-23/1-White, ABS-23/1-Black).

**Key Fields:**
- `total_length_m`: Total length of this edge material type (with overhang/ráhagyás)
- `price_per_m`: Price per meter snapshot

---

### 5. `quote_services_breakdown` Table

```sql
CREATE TABLE public.quote_services_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_materials_pricing_id UUID NOT NULL REFERENCES public.quote_materials_pricing(id) ON DELETE CASCADE,
  
  service_type VARCHAR(50) NOT NULL, -- 'panthelyfuras', 'duplungolas', 'szogvagas'
  quantity NUMERIC(10,2) NOT NULL, -- holes, m², or panels
  unit_price NUMERIC(10,2) NOT NULL, -- snapshot
  
  -- Cost breakdown
  net_price NUMERIC(12,2) NOT NULL,
  vat_amount NUMERIC(12,2) NOT NULL,
  gross_price NUMERIC(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose:** Detailed breakdown of additional services costs per material.

**Service Types:**
- `panthelyfuras`: Hinge hole drilling (quantity = number of holes)
- `duplungolas`: Groove cutting (quantity = m²)
- `szogvagas`: Angle cutting (quantity = number of panels)

---

### 6. Supporting Functions

#### `generate_quote_number()` Function

```sql
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_quote_number VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Find the highest number for current year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(quote_number FROM POSITION('-' IN quote_number) + 6)
      AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || current_year || '-%'
    AND deleted_at IS NULL;
  
  -- Format: Q-2025-001
  new_quote_number := 'Q-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_quote_number;
END;
$$ LANGUAGE plpgsql;
```

**Purpose:** Auto-generate sequential quote numbers per year.

**Format:** `Q-YYYY-NNN`
- Q-2025-001 (first quote of 2025)
- Q-2025-002 (second quote of 2025)
- Q-2026-001 (first quote of 2026, resets counter)

---

## Architecture

### High-Level Data Flow

```
User fills form on /opti
    ↓
User clicks "Optimalizálás" → Optimization runs
    ↓
User clicks "Árajánlat mentése"
    ↓
Frontend calls POST /api/quotes
    ↓
API authenticates user
    ↓
API checks if customer exists
    ├─ Exists: Use customer_id
    └─ New: Create customer (use tenant email as default)
    ↓
API generates quote number (if new quote)
    ↓
API saves data in transaction:
    ├─ Insert/Update quotes table
    ├─ Insert quote_panels (all panels)
    ├─ For each material:
    │   ├─ Insert quote_materials_pricing
    │   ├─ Insert quote_edge_materials_breakdown (for each edge type)
    │   └─ Insert quote_services_breakdown (for each service)
    ↓
Success: Return quote number to frontend
    ↓
Frontend displays success toast
```

---

## Implementation Details

### 1. Database Setup

**File:** `create_quotes_system.sql`

Run this SQL script in Supabase SQL Editor to create all necessary tables, indexes, triggers, and functions.

**Tables Created:**
1. `quotes` - Main quote table
2. `quote_panels` - Panel specifications
3. `quote_materials_pricing` - Pricing snapshots per material
4. `quote_edge_materials_breakdown` - Edge material cost details
5. `quote_services_breakdown` - Additional services cost details

**ENUM Type Created:**
```sql
CREATE TYPE quote_status AS ENUM ('draft', 'accepted', 'in_production', 'done', 'rejected');
```

**Indexes Created:**
- Customer lookup by quote
- Status filtering
- Quote number lookup
- Created date sorting
- All foreign key relationships

---

### 2. Backend Implementation

#### A. Server-Side Data Fetching

**File:** `src/lib/supabase-server.ts`

**New Function Added:**

```typescript
export async function getTenantCompany() {
  const startTime = performance.now()
  
  const { data, error } = await supabaseServer
    .from('tenant_company')
    .select('id, name, email')
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching tenant company:', error)
    return null
  }

  return data
}
```

**Purpose:** Fetch tenant company email to use as default when auto-creating customers.

---

#### B. API Route: `/api/quotes`

**File:** `src/app/api/quotes/route.ts`

**Endpoint:** `POST /api/quotes`

**Request Body:**
```typescript
{
  quoteId: string | null,           // null for new quote, UUID for editing
  customerData: {
    id: string | null,              // null if new customer
    name: string,                   // REQUIRED
    email: string,
    mobile: string,
    discount_percent: number,
    billing_name: string,
    billing_country: string,
    billing_city: string,
    billing_postal_code: string,
    billing_street: string,
    billing_house_number: string,
    billing_tax_number: string,
    billing_company_reg_number: string
  },
  panels: [
    {
      material_id: string,
      width_mm: number,
      height_mm: number,
      quantity: number,
      label: string | null,
      edge_material_a_id: string | null,
      edge_material_b_id: string | null,
      edge_material_c_id: string | null,
      edge_material_d_id: string | null,
      panthelyfuras_quantity: number,
      panthelyfuras_oldal: string | null,
      duplungolas: boolean,
      szogvagas: boolean
    }
  ],
  optimizationResults: { ... },     // Complete optimization result object
  quoteCalculations: {
    total_net: number,
    total_vat: number,
    total_gross: number,
    materials: [
      {
        material_id: string,
        material_name: string,
        board_width_mm: number,
        board_length_mm: number,
        thickness_mm: number,
        grain_direction: boolean,
        on_stock: boolean,
        boards_used: number,
        usage_percentage: number,
        pricing_method: 'panel_area' | 'full_board',
        charged_sqm: number | null,
        price_per_sqm: number,
        vat_rate: number,
        currency: string,
        usage_limit: number,
        waste_multi: number,
        material_cost: { net, vat, gross },
        edge_materials_cost: { net, vat, gross },
        cutting_cost: { length_m, net, vat, gross },
        edge_materials: [
          {
            edge_material_id: string,
            name: string,
            total_length_m: number,
            price_per_m: number,
            net: number,
            vat: number,
            gross: number
          }
        ],
        additional_services: {
          panthelyfuras: { quantity, unit_price, net_price, vat_amount, gross_price, ... } | null,
          duplungolas: { quantity, unit_price, net_price, vat_amount, gross_price, ... } | null,
          szogvagas: { quantity, unit_price, net_price, vat_amount, gross_price, ... } | null
        },
        total_services_net: number,
        total_services_vat: number,
        total_services_gross: number,
        total: { net, vat, gross }
      }
    ]
  }
}
```

**Response:**
```typescript
{
  success: true,
  message: "Árajánlat sikeresen mentve",
  quoteId: "uuid",
  quoteNumber: "Q-2025-001"
}
```

**Process Flow:**

1. **Authentication**
   - Uses `@supabase/ssr` with cookies for authentication
   - Extracts current user from session
   - Returns 401 if not authenticated

2. **Customer Handling**
   - If `customerData.id` exists → Use existing customer
   - If `customerData.id` is null:
     - Fetch tenant company email via `getTenantCompany()`
     - Create new customer with all billing data
     - Use tenant email as default if email not provided
     - Handle duplicate name/email errors gracefully

3. **Quote Number Generation**
   - For new quotes: Call `generate_quote_number()` database function
   - For existing quotes: Use existing number

4. **Data Deletion (for edits)**
   - If `quoteId` provided, delete existing `quote_panels` and `quote_materials_pricing`
   - CASCADE will auto-delete related edge and service breakdowns

5. **Quote Creation/Update**
   - Calculate `final_total_after_discount = total_gross × (1 - discount_percent / 100)`
   - Insert/update `quotes` table

6. **Panels Insertion**
   - Insert all panels with edges and services
   - One row per panel entry

7. **Pricing Insertion**
   - For each material in the quote:
     - Insert `quote_materials_pricing` with complete snapshot
     - Insert `quote_edge_materials_breakdown` for each edge type
     - Insert `quote_services_breakdown` for each active service

8. **Response**
   - Return success with quote number
   - Frontend displays toast notification

---

**Endpoint:** `GET /api/quotes`

**Query Parameters:**
- `status` (optional): Filter by quote status

**Response:**
```typescript
[
  {
    id: "uuid",
    quote_number: "Q-2025-001",
    status: "draft",
    total_net: 96712,
    total_vat: 26112.24,
    total_gross: 122824.24,
    discount_percent: 10,
    final_total_after_discount: 110541.82,
    created_at: "2025-01-06T...",
    updated_at: "2025-01-06T...",
    customers: {
      id: "uuid",
      name: "Customer Name",
      email: "email@example.com"
    }
  }
]
```

---

### 3. Frontend Implementation

#### A. OptiClient.tsx Updates

**File:** `src/app/(dashboard)/opti/OptiClient.tsx`

**New State Variables:**

```typescript
// Quote saving state
const [isSavingQuote, setIsSavingQuote] = useState(false)
const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)
```

**New Function: `saveQuote()`**

**Location:** Lines 1192-1334

**Purpose:** Prepare and send quote data to API endpoint.

**Process:**

1. **Validation**
   - Check if optimization has run
   - Check if customer name is filled

2. **Panel Data Preparation**
   - Map `addedPanels` to API format
   - Extract material IDs from panel strings
   - Parse dimensions from strings to integers
   - Include all edge materials and services

3. **Customer Data Preparation**
   - Include selected customer ID (if from dropdown)
   - Include all form data (name, email, mobile, billing info)
   - Include discount percentage

4. **Quote Calculations Preparation**
   - Map `quoteResult` structure to API format
   - Extract material snapshots from `materials` array
   - Calculate `boards_used` and `usage_percentage` from boards array
   - Calculate `charged_sqm` for on_stock materials
   - Map edge material names back to IDs
   - Include complete cost breakdowns

5. **API Call**
   - POST to `/api/quotes`
   - Handle success: Set `savedQuoteNumber`, show success toast
   - Handle error: Show error toast

**Key Code Sections:**

```typescript
// Extract material ID from táblásAnyag string format
const materialMatch = panel.táblásAnyag.match(/^(.+?)\s*\((\d+)×(\d+)mm\)$/)
const materialName = materialMatch ? materialMatch[1].trim() : ''
const material = materials.find(m => m.name === materialName)

// Map edge material names back to IDs
const edgeMaterial = edgeMaterials.find(em => {
  const displayName = `${em.type}-${em.width}/${em.thickness}-${em.decor}`
  return displayName === edge.edge_material_name
})
```

---

#### B. UI Updates

**Save Quote Button**

**Location:** After Optimalizálás button (lines 2558-2590)

**Visibility Logic:**
- Only shown **after** optimization has run successfully
- Only shown if `optimizationResult` and `quoteResult` exist

**Button States:**
1. **Initial:** "Árajánlat mentése"
2. **Saving:** "Mentés..." (with spinner)
3. **Saved:** "Mentve: Q-2025-001"

**Button Code:**

```typescript
{optimizationResult && quoteResult && (
  <Tooltip 
    title={!customerData.name.trim() ? 'Kérjük, töltse ki a megrendelő nevét!' : ''}
    arrow
  >
    <span>
      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={saveQuote}
        disabled={isSavingQuote || !customerData.name.trim()}
        sx={{ minWidth: 200, py: 1.5, px: 4 }}
      >
        {isSavingQuote ? (
          <>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Mentés...
          </>
        ) : savedQuoteNumber ? (
          `Mentve: ${savedQuoteNumber}`
        ) : (
          'Árajánlat mentése'
        )}
      </Button>
    </span>
  </Tooltip>
)}
```

**Disabled Conditions:**
- Currently saving (`isSavingQuote`)
- Customer name is empty

---

## Data Flow

### Saving a New Quote

```
1. USER ACTION
   └─ User fills customer data
   └─ User adds panels with edges/services
   └─ User clicks "Optimalizálás" → Optimization runs
   └─ User clicks "Árajánlat mentése"

2. FRONTEND (OptiClient.tsx)
   └─ saveQuote() function called
   └─ Validates optimization has run
   └─ Validates customer name exists
   └─ Prepares 4 data payloads:
      ├─ customerData (from form state)
      ├─ panels (from addedPanels state)
      ├─ optimizationResults (from optimizationResult state)
      └─ quoteCalculations (from quoteResult useMemo)
   └─ POST to /api/quotes

3. API ROUTE (/api/quotes/route.ts)
   └─ Authenticates user (via cookies + @supabase/ssr)
   └─ Checks if customer exists by ID
   └─ If new customer:
      ├─ Fetches tenant company email
      ├─ Creates customer with all billing data
      └─ Uses tenant email as default
   └─ Generates quote number (Q-2025-XXX)
   └─ Inserts quotes table row
   └─ Inserts all panels (quote_panels)
   └─ For each material:
      ├─ Inserts quote_materials_pricing
      ├─ Inserts quote_edge_materials_breakdown (for each edge type)
      └─ Inserts quote_services_breakdown (for active services)
   └─ Returns quote number

4. FRONTEND RESPONSE
   └─ Updates savedQuoteNumber state
   └─ Button text changes to "Mentve: Q-2025-001"
   └─ Shows success toast
```

---

### Editing an Existing Quote

```
1. USER LOADS QUOTE
   └─ User navigates to /opti?quote_id=xxx (future feature)
   └─ Frontend loads quote data
   └─ Populates customer data, panels, runs optimization

2. USER MODIFIES & SAVES
   └─ User modifies panels/customer data
   └─ User clicks "Optimalizálás" again
   └─ User clicks "Árajánlat mentése"

3. API ROUTE (quoteId provided)
   └─ Authenticates user
   └─ Deletes existing quote_panels (quote_id = xxx)
   └─ Deletes existing quote_materials_pricing (quote_id = xxx)
      └─ CASCADE auto-deletes edge & service breakdowns
   └─ Updates quotes table (keeps same ID & number, updates totals)
   └─ Re-inserts all panels and pricing (same as new quote)
   └─ Returns same quote number

4. FRONTEND
   └─ Shows "Mentve: Q-2025-001" (same number)
   └─ Success toast
```

---

## Key Technical Decisions

### Why Store Everything as Snapshots?

**Problem:** Material prices change over time.

**Example:**
- January: Material costs 5,000 HUF/m²
- Customer receives quote Q-2025-001 for 120,000 HUF
- March: Material price changes to 6,000 HUF/m²
- Customer accepts quote → Must honor original 120,000 HUF price

**Solution:** Store complete pricing snapshot in `quote_materials_pricing`:
- `price_per_sqm`: 5,000 (original price)
- `vat_rate`: 0.27 (27% at time of quote)
- `usage_limit`, `waste_multi`: Original material settings
- All calculated costs (material, edges, cutting, services)

---

### Why charged_sqm Field?

**Problem:** Need to reproduce the exact pricing logic display.

**For `on_stock = true` materials:**
- UI shows: "2.45m² × 1.2 = 2.94m² (panel × hulladékszorzó)"
- Customer is charged for 2.94m², not 2.45m²
- `charged_sqm = 2.94` (sum of all panel areas × waste_multi)

**For `on_stock = false` materials:**
- UI shows: "5.796m² (teljes tábla árazva)"
- Customer is charged for full boards
- `charged_sqm = NULL` (not applicable)

This allows the quote display page to show exactly what the customer was charged for.

---

### Why grain_direction in pricing but not in panels?

**Reason:** Grain direction is a **material property**, not a **panel property**.

- Panel table stores: width, height, quantity, label, edges, services
- Pricing table stores: material name, board dimensions, **grain_direction** (material snapshot)

This matches the data model: grain direction defines how the material can be optimized, not how individual panels are oriented.

---

### Customer Auto-Creation Logic

**Scenario 1: User selects from dropdown**
```typescript
customerData.id = "uuid-of-existing-customer"
// → Use existing customer, no creation needed
```

**Scenario 2: User types new name**
```typescript
customerData.id = null
customerData.name = "New Customer Inc."
customerData.email = "" // User didn't fill email

// → API creates new customer:
{
  name: "New Customer Inc.",
  email: "info@turinova.hu", // ← From tenant_company table
  mobile: "",
  discount_percent: 0,       // ← Default
  billing_name: "",
  billing_country: "Magyarország", // ← Default
  ... (all other fields from form)
}
```

**Error Handling:**
- If customer name already exists → Find and use existing customer ID
- If email already exists → Return 409 error
- Any other error → Return 500 with details

---

## Frontend Components

### Quote Save Button Component

**Visual Design:**
- Placed next to "Optimalizálás" button
- Same size (large, minWidth: 200px)
- Primary color (blue)
- Only visible after optimization completes

**States:**
1. **Hidden** (default) - Before optimization
2. **Enabled** - After optimization, ready to save
3. **Disabled** - If customer name empty
4. **Loading** - While saving (spinner + "Mentés...")
5. **Success** - After save (shows quote number)

---

### User Experience Flow

1. **User opens `/opti` page**
   - Sees empty form
   - "Árajánlat mentése" button is hidden

2. **User fills data**
   - Selects/types customer name
   - Fills billing data (optional)
   - Adds panels with dimensions, edges, services

3. **User clicks "Optimalizálás"**
   - Button shows spinner
   - Optimization runs
   - Results appear in accordions
   - "Árajánlat mentése" button **appears**

4. **User reviews quote**
   - Checks Árajánlat accordion
   - Verifies pricing is correct
   - Reviews panel placements

5. **User clicks "Árajánlat mentése"**
   - Button shows "Mentés..." with spinner
   - Data is saved to database
   - Button changes to "Mentve: Q-2025-001"
   - Success toast appears: "Árajánlat sikeresen mentve: Q-2025-001"

6. **User continues**
   - Can modify panels and re-optimize
   - Can save again (will create new quote with new number)
   - Can navigate away (quote is saved)

---

## Data Mapping Reference

### Panel Data Mapping

| Frontend State (`addedPanels`) | API Payload | Database Column |
|-------------------------------|-------------|-----------------|
| `táblásAnyag` (string) | `material_id` (extracted) | `material_id` |
| `hosszúság` (string) | `width_mm` (parseInt) | `width_mm` |
| `szélesség` (string) | `height_mm` (parseInt) | `height_mm` |
| `darab` (string) | `quantity` (parseInt) | `quantity` |
| `jelölés` (string) | `label` | `label` |
| `élzárásA` (UUID) | `edge_material_a_id` | `edge_material_a_id` |
| `élzárásB` (UUID) | `edge_material_b_id` | `edge_material_b_id` |
| `élzárásC` (UUID) | `edge_material_c_id` | `edge_material_c_id` |
| `élzárásD` (UUID) | `edge_material_d_id` | `edge_material_d_id` |
| `pánthelyfúrás_mennyiség` | `panthelyfuras_quantity` | `panthelyfuras_quantity` |
| `pánthelyfúrás_oldal` | `panthelyfuras_oldal` | `panthelyfuras_oldal` |
| `duplungolás` | `duplungolas` | `duplungolas` |
| `szögvágás` | `szogvagas` | `szogvagas` |

---

### Quote Result Mapping

| QuoteResult Property | Payload Property | Database Column |
|---------------------|------------------|-----------------|
| `grand_total_net` | `total_net` | `quotes.total_net` |
| `grand_total_vat` | `total_vat` | `quotes.total_vat` |
| `grand_total_gross` | `total_gross` | `quotes.total_gross` |
| `materials[].total_material_net` | `material_cost.net` | `material_net` |
| `materials[].total_edge_net` | `edge_materials_cost.net` | `edge_materials_net` |
| `materials[].total_cutting_net` | `cutting_cost.net` | `cutting_net` |
| `materials[].total_services_net` | `total_services_net` | `services_net` |
| `materials[].boards.length` | `boards_used` | `boards_used` |
| `materials[].boards[].usage_percentage` | `usage_percentage` (avg) | `usage_percentage` |
| `materials[].boards[].charged_area_m2` | `charged_sqm` (sum) | `charged_sqm` |

---

## Testing

### Test Cases

#### ✅ Test 1: Save Quote with Existing Customer

**Steps:**
1. Open `/opti`
2. Select existing customer from dropdown
3. Add 2 panels (1000×1000) on F021 ST75 material
4. Add edge materials (A, B, C, D)
5. Enable services (Pánthelyfúrás: 4, Duplungolás: Yes)
6. Click "Optimalizálás"
7. Verify quote displays correctly
8. Click "Árajánlat mentése"

**Expected:**
- ✅ Customer is not duplicated
- ✅ Quote number Q-2025-001 is generated
- ✅ 2 panel rows in `quote_panels`
- ✅ 1 row in `quote_materials_pricing`
- ✅ Edge breakdowns saved
- ✅ Service breakdowns saved
- ✅ Toast shows "Árajánlat sikeresen mentve: Q-2025-001"
- ✅ Button shows "Mentve: Q-2025-001"

---

#### ✅ Test 2: Save Quote with New Customer

**Steps:**
1. Open `/opti`
2. Type new customer name "Test Customer Inc."
3. Fill billing data (optional)
4. Add panels and optimize
5. Click "Árajánlat mentése"

**Expected:**
- ✅ New customer created in `customers` table
- ✅ Email defaults to tenant company email (info@turinova.hu)
- ✅ All billing data saved
- ✅ Quote created with customer_id reference
- ✅ Quote number Q-2025-002 generated

**Verify in Database:**
```sql
-- Check customer was created
SELECT * FROM customers WHERE name = 'Test Customer Inc.';

-- Check quote references correct customer
SELECT q.quote_number, c.name, c.email 
FROM quotes q
JOIN customers c ON q.customer_id = c.id
WHERE q.quote_number = 'Q-2025-002';
```

---

#### ✅ Test 3: Multiple Materials Quote

**Steps:**
1. Add panels with material F021 ST75
2. Add panels with material F108 ST9
3. Optimize and save

**Expected:**
- ✅ 2 rows in `quote_materials_pricing` (one per material)
- ✅ Each material has separate edge and service breakdowns
- ✅ Grand totals sum both materials correctly

---

#### ✅ Test 4: Quote Number Sequence

**Steps:**
1. Save quote → Q-2025-001
2. Save another quote → Q-2025-002
3. Save another quote → Q-2025-003

**Expected:**
- ✅ Sequential numbering
- ✅ No duplicates
- ✅ All quotes visible in database

```sql
SELECT quote_number, created_at 
FROM quotes 
ORDER BY created_at DESC;
```

---

## Database Queries for Verification

### View All Quotes with Customer Names

```sql
SELECT 
  q.quote_number,
  q.status,
  c.name AS customer_name,
  q.total_gross,
  q.discount_percent,
  q.final_total_after_discount,
  q.created_at
FROM quotes q
JOIN customers c ON q.customer_id = c.id
WHERE q.deleted_at IS NULL
ORDER BY q.created_at DESC;
```

---

### View Quote Details (Complete Breakdown)

```sql
-- Quote header
SELECT * FROM quotes WHERE quote_number = 'Q-2025-001';

-- Panels
SELECT 
  qp.*,
  m.name AS material_name
FROM quote_panels qp
JOIN materials m ON qp.material_id = m.id
WHERE qp.quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-2025-001');

-- Materials pricing
SELECT * FROM quote_materials_pricing
WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-2025-001');

-- Edge materials breakdown
SELECT 
  qemb.*,
  qmp.material_name
FROM quote_edge_materials_breakdown qemb
JOIN quote_materials_pricing qmp ON qemb.quote_materials_pricing_id = qmp.id
WHERE qmp.quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-2025-001');

-- Services breakdown
SELECT 
  qsb.*,
  qmp.material_name
FROM quote_services_breakdown qsb
JOIN quote_materials_pricing qmp ON qsb.quote_materials_pricing_id = qmp.id
WHERE qmp.quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-2025-001');
```

---

### Count Quote Components

```sql
SELECT 
  q.quote_number,
  COUNT(DISTINCT qp.id) AS total_panels,
  COUNT(DISTINCT qmp.id) AS total_materials,
  COUNT(DISTINCT qemb.id) AS total_edge_types,
  COUNT(DISTINCT qsb.id) AS total_services
FROM quotes q
LEFT JOIN quote_panels qp ON q.id = qp.quote_id
LEFT JOIN quote_materials_pricing qmp ON q.id = qmp.quote_id
LEFT JOIN quote_edge_materials_breakdown qemb ON qmp.id = qemb.quote_materials_pricing_id
LEFT JOIN quote_services_breakdown qsb ON qmp.id = qsb.quote_materials_pricing_id
WHERE q.quote_number = 'Q-2025-001'
GROUP BY q.quote_number;
```

---

## Future Enhancements

### Phase 1: Quote Management Page (Planned)

**URL:** `/quotes` or `/arajanlatok`

**Features:**
- List all quotes with filters (status, customer, date range)
- Search by quote number or customer name
- Click quote → Load in `/opti` page for viewing/editing
- Change quote status (Draft → Accepted → In Production → Done)
- Delete quotes (soft delete)
- Export quote as PDF

---

### Phase 2: Quote Loading & Editing (Planned)

**URL:** `/opti?quote_id=xxx`

**Features:**
- Load quote data from database
- Restore panels to table
- Restore customer data to form
- Re-run optimization with saved settings
- Edit and re-save (updates existing quote)

**Implementation:**
- New `GET /api/quotes/[id]` endpoint
- Returns complete quote with all panels and pricing
- Frontend populates state from loaded data
- `saveQuote()` function detects quoteId and calls API with edit mode

---

### Phase 3: Quote to Order Conversion (Future)

**Features:**
- "Accept Quote" button → Creates production order
- Locks quote (no further edits)
- Initiates stock management workflow
- Links to material procurement if needed

---

### Phase 4: PDF Export (Future)

**Features:**
- Generate professional PDF from quote data
- Include company logo and branding
- Show customer billing details
- Show complete pricing breakdown
- Show panel specifications table
- Add terms and conditions
- Email PDF to customer

---

## Error Handling

### Frontend Errors

1. **Optimization Not Run**
   - Error: "Futtassa le az optimalizálást mentés előtt!"
   - Action: User must click Optimalizálás first

2. **Missing Customer Name**
   - Error: "Kérjük, töltse ki a megrendelő nevét!"
   - Action: User must fill customer name

3. **API Error**
   - Error: Shows specific error message from API
   - Action: User retries or contacts support

---

### Backend Errors

1. **Authentication Failed (401)**
   - Cause: User session expired
   - Response: `{ error: 'Unauthorized' }`
   - Frontend: Shows login prompt

2. **Customer Creation Failed (409)**
   - Cause: Email already exists
   - Response: `{ error: 'Customer already exists with this email' }`
   - Frontend: Shows error, user updates email

3. **Quote Number Generation Failed**
   - Cause: Database function error
   - Response: `{ error: 'Failed to generate quote number' }`
   - Fallback: Manual retry or admin intervention

4. **Data Insertion Failed (500)**
   - Cause: Database constraint violation, missing fields
   - Response: `{ error: 'Failed to save quote', details: '...' }`
   - Logging: Full error logged to console for debugging

---

## Performance Considerations

### Database Indexes

All critical indexes created for fast lookups:

```sql
-- Fast customer lookup
idx_quotes_customer_id ON quotes(customer_id)

-- Fast status filtering
idx_quotes_status ON quotes(status)

-- Fast quote number lookup
idx_quotes_quote_number ON quotes(quote_number)

-- Fast date sorting
idx_quotes_created_at ON quotes(created_at DESC)

-- Fast foreign key lookups
idx_quote_panels_quote_id ON quote_panels(quote_id)
idx_qmp_quote_id ON quote_materials_pricing(quote_id)
```

---

### Transaction Safety

**Current Implementation:**
- Manual delete-and-insert pattern
- Multiple separate INSERT operations

**Risk:** If one insert fails mid-process, partial data may be saved.

**Future Enhancement:** Wrap in explicit transaction:

```typescript
await supabase.rpc('begin_transaction')
try {
  // All inserts
  await supabase.rpc('commit_transaction')
} catch (error) {
  await supabase.rpc('rollback_transaction')
}
```

---

## Security

### Row Level Security (RLS)

**Recommended RLS Policies:**

```sql
-- Users can only see quotes they created or are assigned to
CREATE POLICY "Users can view their own quotes"
  ON public.quotes
  FOR SELECT
  USING (
    created_by = auth.uid() 
    OR 
    customer_id IN (
      SELECT id FROM customers 
      WHERE deleted_at IS NULL
    )
  );

-- Users can only create quotes if authenticated
CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only update quotes they created
CREATE POLICY "Users can update their own quotes"
  ON public.quotes
  FOR UPDATE
  USING (created_by = auth.uid());
```

**Note:** RLS policies should be applied based on your specific business requirements.

---

## Troubleshooting

### Issue: "Unauthorized" Error

**Symptom:** Button click returns 401 error.

**Cause:** Session expired or authentication not working in API route.

**Solution:**
- Check browser cookies for Supabase auth token
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Use `@supabase/ssr` with cookies in API route (✅ implemented)

---

### Issue: Quote Number Doesn't Increment

**Symptom:** Multiple quotes have the same number.

**Cause:** Race condition in `generate_quote_number()` function.

**Solution:**
- Add database-level lock:
```sql
SELECT pg_advisory_lock(12345);
-- Generate number
SELECT pg_advisory_unlock(12345);
```

---

### Issue: Missing Edge Material Data

**Symptom:** Edge materials not saved in breakdown table.

**Cause:** Edge material ID mapping failed (name → ID conversion).

**Solution:**
- Verify `formatEdgeMaterialName()` function produces correct format
- Check `edgeMaterials.find()` logic in `saveQuote()`
- Add logging to track which edges are found/not found

---

## Code Maintenance

### Adding New Fields to Quotes

**Example:** Add "delivery_date" field to quotes.

1. **Database:**
```sql
ALTER TABLE quotes ADD COLUMN delivery_date DATE NULL;
```

2. **API Route:**
```typescript
const quoteData = {
  ...existing fields,
  delivery_date: body.deliveryDate || null
}
```

3. **Frontend:**
```typescript
// Add state
const [deliveryDate, setDeliveryDate] = useState('')

// Add to payload
const payload = {
  ...existing,
  deliveryDate: deliveryDate
}
```

---

### Adding New Service Type

**Example:** Add "lyukasztás" (hole punching) service.

1. **Database:**
```sql
ALTER TABLE cutting_fees 
ADD COLUMN lyukasztas_fee_per_hole NUMERIC(10,2) DEFAULT 30;
```

2. **Panel Interface:**
```typescript
interface Panel {
  ...
  lyukasztás_mennyiség: number
}
```

3. **Quote Calculation:** Update `calculateAdditionalServices()`

4. **API:** Handle new service type in breakdown insertion

---

## Files Modified/Created

### New Files

1. `/Volumes/T7/erp_turinova_new/starter-kit/create_quotes_system.sql`
   - Complete database schema for quotes system
   - 6 tables, indexes, triggers, functions

2. `/Volumes/T7/erp_turinova_new/starter-kit/src/app/api/quotes/route.ts`
   - POST: Save quote with customer auto-creation
   - GET: List all quotes

### Modified Files

1. `/Volumes/T7/erp_turinova_new/starter-kit/src/lib/supabase-server.ts`
   - Added `getTenantCompany()` function

2. `/Volumes/T7/erp_turinova_new/starter-kit/src/app/(dashboard)/opti/OptiClient.tsx`
   - Added `saveQuote()` function (lines 1192-1334)
   - Added quote saving state variables
   - Added "Árajánlat mentése" button (lines 2558-2590)

---

## Summary

The quote saving system is now **fully functional** and allows users to:

✅ Save optimization results as formal quotes  
✅ Auto-create customers if they don't exist  
✅ Store complete pricing snapshots (immune to future price changes)  
✅ Track all panel specifications, edges, and services  
✅ Generate sequential quote numbers (Q-2025-001, Q-2025-002, ...)  
✅ View saved quote number after successful save  

**Next Steps:**
- Implement `/quotes` management page
- Add quote loading & editing functionality
- Add PDF export
- Add status workflow management

---

## Support

For questions or issues with the quote system, contact the development team.

**Related Documentation:**
- [ADDITIONAL_SERVICES_IMPLEMENTATION.md](./ADDITIONAL_SERVICES_IMPLEMENTATION.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [Chat Archive: 2025-01-06 Quote System](./chat-archives/2025-01-06_quote_system.md)


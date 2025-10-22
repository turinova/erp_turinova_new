# Customer Portal - Kereső (Search) Page Implementation

## 🎯 Overview
Created a material search page that queries the **selected company's database** in real-time, showing materials and pricing from the company the customer is connected to. This implements true multi-tenant functionality.

---

## 📁 Files Created/Updated

### 1. **Page Component (SSR)**
**Path**: `/customer-portal/app/(dashboard)/search/page.tsx`
- Simple wrapper that renders `SearchClient`
- Metadata for SEO

### 2. **Client Component**
**Path**: `/customer-portal/app/(dashboard)/search/SearchClient.tsx`
- **Exact copy** of main app's `/search/SearchClient.tsx`
- Real-time search with 300ms debounce
- Displays materials and linear materials in a table
- Color-coded pricing display

**Features**:
- Search input with loading indicator
- Debounced search (300ms)
- Combined results table
- Price calculations with VAT
- Color-coded chips for material types
- "Nincs találat" message when no results

### 3. **API Endpoint**
**Path**: `/customer-portal/app/api/search/route.ts`

**Multi-Tenant Architecture**:
```
┌─────────────────────────────────────────────┐
│ Customer Portal API                         │
├─────────────────────────────────────────────┤
│ 1. Authenticate customer                    │
│ 2. Get customer's selected_company_id       │
│ 3. Fetch company's Supabase credentials     │
│ 4. Create Supabase client for company DB    │
│ 5. Search materials in company DB           │
│ 6. Return results with company's pricing    │
└─────────────────────────────────────────────┘
```

**Process Flow**:
```typescript
// Step 1: Authenticate
portalSupabase.auth.getUser() → user

// Step 2: Get selected company
portalSupabase.from('portal_customers')
  .select('selected_company_id')
  .eq('id', user.id)

// Step 3: Get company credentials
portalSupabase.from('companies')
  .select('supabase_url, supabase_anon_key')
  .eq('id', selected_company_id)

// Step 4: Create company DB client
companySupabase = createSupabaseClient(
  company.supabase_url,
  company.supabase_anon_key
)

// Step 5: Search in company DB (parallel)
Promise.all([
  companySupabase.from('materials').search(),
  companySupabase.from('linear_materials').search()
])
```

### 4. **Menu Update**
**Path**: `/customer-portal/data/navigation/verticalMenuData.tsx`
- Added "Kereső" menu item
- Icon: `ri-search-line` (red color: #E74C3C)
- Position: Between Kezdőlap and Beállítások

### 5. **Permissions Update**
**Paths**:
- `/customer-portal/permissions/PermissionProvider.tsx` - Added `/search`
- `/customer-portal/hooks/useNavigation.ts` - Always show `/search`

---

## 🏗️ Multi-Tenant Architecture

### Database Structure:
```
Customer Portal DB (oatbbtbkerxogzvwicxx)
├── companies
│   ├── id
│   ├── name
│   ├── supabase_url ← Company's database URL
│   └── supabase_anon_key ← Company's anon key
├── portal_customers
│   ├── id
│   ├── name
│   ├── email
│   └── selected_company_id → companies(id)
└── portal_quotes (customer's draft quotes)

Company Database 1 (e.g., xgkaviefifbllbmfbyfe)
├── materials ← Searched by customer
├── linear_materials ← Searched by customer
├── brands
└── vat

Company Database 2 (different Supabase project)
├── materials
├── linear_materials
└── ...
```

### Connection Flow:
1. **Customer A** (selected_company_id = Company 1)
   - Searches → Connects to Company 1's database
   - Sees Company 1's materials and pricing

2. **Customer B** (selected_company_id = Company 2)
   - Searches → Connects to Company 2's database
   - Sees Company 2's materials and pricing

---

## 🎨 UI Design (Matching Main App Exactly)

### Search Field:
- Placeholder: "Keresés anyagok között..."
- Start adornment: Search icon (or loading spinner)
- Full width
- 300ms debounce

### Results Table:
| Column | Description | Color Coding |
|--------|-------------|--------------|
| Márka | Brand name | - |
| Megnevezés | Material name | - |
| Típus | Chip: "Bútorlap" or type | Red (panel) / Blue (linear) |
| Hosszúság | Length in mm | - |
| Szélesség | Width in mm | - |
| Vastagság | Thickness in mm | - |
| **Fm ár** | Price per meter (linear only) | **Blue background** (#E3F2FD) |
| **Nm ár** | Price per sqm (panels only) | **Green background** (#E8F5E8) |
| Egész ár | Total price for whole piece | - |

### Color Scheme:
- **Linear Materials**: Blue chip (#2196F3), blue Fm ár cell
- **Panel Materials**: Red chip (#F44336), green Nm ár cell

---

## 💰 Price Calculations

### Panel Materials (Bútorlap):
```typescript
const vatRate = vat.kulcs / 100
const grossMultiplier = 1 + vatRate

// Nm ár (price per square meter with VAT)
nmAr = Math.round(price_per_sqm * grossMultiplier)

// Egész ár (total price for whole board)
egeszAr = Math.round(
  price_per_sqm * grossMultiplier * width_mm * length_mm / 1000000
)
```

### Linear Materials (Szálas anyagok):
```typescript
const vatRate = vat.kulcs / 100
const grossMultiplier = 1 + vatRate

// Fm ár (price per meter with VAT)
fmAr = Math.round(price_per_m * grossMultiplier)

// Egész ár (total price for whole length)
egeszAr = Math.round(
  price_per_m * grossMultiplier * length / 1000
)
```

---

## ⚡ Performance Optimizations

1. **Debounced Search**: 300ms delay prevents excessive API calls
2. **Parallel Queries**: Materials and linear_materials fetched simultaneously
3. **Result Limit**: 50 items per table for fast response
4. **No Cache**: Fresh pricing data on every search
5. **Early Return**: Empty query returns immediately
6. **Company DB Connection**: Only created when needed

---

## 🔐 Security & Data Isolation

### Authentication:
- Customer must be logged in (middleware check)
- API verifies user via `auth.getUser()`

### Data Isolation:
- Each customer only sees their selected company's data
- Company credentials stored securely in portal DB
- No cross-company data leakage
- Customer cannot access other companies' materials

### Company Selection:
- Customer chooses company during registration
- Can change company in Settings page
- Search automatically uses new company when changed

---

## 🧪 Testing Scenarios

### Scenario 1: Basic Search
1. Customer logs in
2. Clicks "Kereső" in menu
3. Types "fehér" in search box
4. Waits 300ms
5. See results from selected company's database
6. Pricing shows company's current prices with VAT

### Scenario 2: No Results
1. Customer searches for "xyz123abc"
2. See message: "Nincs találat a keresési feltételre: 'xyz123abc'"

### Scenario 3: Company Switch
1. Customer goes to Settings
2. Changes selected company
3. Saves settings
4. Goes back to Kereső
5. Searches again
6. See results from NEW company's database

### Scenario 4: Real-time Pricing
1. Company admin updates material price in their database
2. Customer searches for that material
3. See updated price immediately (no cache)

---

## 📊 Example API Flow

### Request:
```
GET /api/search?q=fehér
```

### Process:
```
1. Auth check: customer@example.com ✓
2. Get customer: selected_company_id = "abc-123"
3. Get company: 
   - name: "Test Company"
   - supabase_url: "https://xyz.supabase.co"
   - supabase_anon_key: "eyJ..."
4. Create client for company DB
5. Search materials: ILIKE '%fehér%' → 15 results
6. Search linear_materials: ILIKE '%fehér%' → 3 results
7. Return combined results
```

### Response:
```json
{
  "materials": [
    {
      "id": "...",
      "name": "Fehér matt",
      "brands": { "name": "EGGER" },
      "length_mm": 2800,
      "width_mm": 2070,
      "thickness_mm": 18,
      "price_per_sqm": 12500,
      "vat": { "kulcs": 27 }
    }
  ],
  "linearMaterials": [
    {
      "id": "...",
      "name": "Fehér ABS él",
      "type": "ABS",
      "length": 50000,
      "width": 23,
      "thickness": 2,
      "price_per_m": 150,
      "vat": { "kulcs": 27 }
    }
  ]
}
```

---

## 🎯 Key Differences from Main App

| Feature | Main App | Customer Portal |
|---------|----------|-----------------|
| Database | Own database | **Selected company's database** |
| Credentials | Environment variables | **Fetched from `companies` table** |
| Supabase Client | Static `supabaseServer` | **Dynamic per company** |
| Data Source | Single tenant | **Multi-tenant** |
| Pricing | Company's own prices | **Company's prices (customer view)** |

---

## ✅ Completed Checklist

- [x] Menu item added ("Kereső" with search icon)
- [x] SSR page created
- [x] SearchClient component (exact copy of main app)
- [x] API endpoint with multi-tenant support
- [x] Company database connection logic
- [x] Parallel queries for performance
- [x] Permission filtering updated
- [x] Navigation hook updated
- [x] Same table design as main app
- [x] Same color coding
- [x] Same price calculations
- [x] Same breadcrumbs
- [x] Same "Nincs találat" message
- [x] No cache headers for fresh data
- [x] No changes to main app

---

## 🚀 Ready to Test!

**Test URL**: `http://localhost:3001/search`

1. Login to customer portal
2. Click "Kereső" in menu
3. Type a material name
4. See results from your selected company's database
5. Verify pricing matches company's current prices

**The search page is now fully functional with multi-tenant support!** 🎉


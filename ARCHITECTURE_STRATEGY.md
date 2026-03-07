# Turinova ERP - Strategic Architecture & Future-Proofing Plan

**Last Updated:** 2025-03-15  
**Goal:** Build a long-lasting, future-proof SaaS multitenant ERP system that locks customers in through superior UX and seamless integrations.

---

## 🎯 Core Principles

### 1. **User-First Design (Vendor Lock-In Strategy)**
- **Non-technical users**: Everything must be intuitive, no IT knowledge required
- **Seamless UX**: One-click operations, auto-sync, smart defaults
- **Data richness**: Store more data than competitors, make it valuable
- **Integration depth**: Deep platform integrations that are hard to replicate
- **Time investment**: Users invest time configuring the system → switching cost increases

### 2. **Multi-Platform Architecture**
- **Current**: ShopRenter
- **Future**: Unas, Shopify, POS systems
- **Abstraction**: Platform-agnostic data model with platform-specific adapters

### 3. **Data Normalization Strategy**
- **Global master data**: Units, VAT, Manufacturers/Brands (shared across all platforms)
- **Connection-specific data**: Products, Categories, Orders (platform-specific)
- **Platform mapping**: Store platform-specific IDs in mapping tables

---

## 📊 Data Architecture Patterns

### **Pattern 1: Global Master Data (Like Units/VAT)**
**Use for:** Data that is the same across all platforms and connections

**Examples:**
- ✅ **Units** (mértékegységek) - "db", "kg", "m" are universal
- ✅ **VAT Rates** (ÁFA kulcsok) - Tax rates are country-specific, not platform-specific
- ✅ **Manufacturers/Brands** - "Samsung", "Apple" exist across all platforms
- ✅ **Currencies** - "HUF", "EUR", "USD" are universal

**Characteristics:**
- Single source of truth in ERP
- Created once, used everywhere
- Auto-created during sync from any platform
- Can be manually created/edited
- Soft-deleted (never hard-deleted if used)

**Database Pattern:**
```sql
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE, -- Global uniqueness
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Platform-specific mappings stored separately
CREATE TABLE manufacturer_platform_mappings (
  id UUID PRIMARY KEY,
  manufacturer_id UUID REFERENCES manufacturers(id),
  connection_id UUID REFERENCES webshop_connections(id),
  platform_type VARCHAR, -- 'shoprenter', 'unas', 'shopify', 'pos'
  platform_manufacturer_id TEXT, -- Platform-specific ID
  created_at TIMESTAMPTZ
);
```

### **Pattern 2: Connection-Specific Data (Like Products)**
**Use for:** Data that varies by platform/connection

**Examples:**
- ✅ **Products** - Same product, different SKUs/IDs per platform
- ✅ **Categories** - Different category structures per platform
- ✅ **Orders** - Platform-specific order formats
- ✅ **Customers** - May differ per platform (or unified?)

**Characteristics:**
- Stored per connection
- Platform-specific IDs stored directly
- Sync logic handles platform differences
- Can have different statuses per platform

---

## 🏗️ Manufacturers/Brands: Recommended Approach

### **Decision: GLOBAL (Like Units/VAT)**

**Why Global?**
1. **User Experience**: User creates "Samsung" once, uses it everywhere
2. **Data Consistency**: Same brand = same manufacturer across all platforms
3. **Future-Proof**: Works with ShopRenter, Unas, Shopify, POS
4. **Vendor Lock-In**: Rich manufacturer data (logos, descriptions, websites) stored in ERP
5. **Intuitive**: Non-technical users understand "brands are global"

**Implementation:**

```sql
-- Global manufacturers table (like units, vat)
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraint on name (active records only)
CREATE UNIQUE INDEX manufacturers_name_unique_active 
ON manufacturers (name) 
WHERE deleted_at IS NULL;

-- Platform-specific mappings (optional, for sync tracking)
CREATE TABLE manufacturer_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES webshop_connections(id) ON DELETE CASCADE,
  platform_manufacturer_id TEXT, -- ShopRenter ID, Shopify ID, etc.
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(manufacturer_id, connection_id)
);
```

**Product Relationship:**
```sql
-- In shoprenter_products table
ALTER TABLE shoprenter_products 
  ADD COLUMN manufacturer_id UUID REFERENCES manufacturers(id);

-- Keep shoprenter_products.manufacturer_id (ShopRenter ID) for backward compatibility
-- But prefer using manufacturers.id for new code
```

**Sync Logic:**
1. **Pull from ShopRenter**: Auto-create manufacturer if not exists (by name)
2. **Push to ShopRenter**: Use platform mapping or create in ShopRenter
3. **Manual creation**: Create in ERP, sync to all connected platforms
4. **Edit**: Update in ERP, sync changes to platforms

---

## 🔄 Platform Abstraction Strategy

### **Current State:**
- ShopRenter-specific code scattered throughout
- Direct API calls to ShopRenter
- Hard to add new platforms

### **Future State: Platform Adapter Pattern**

```typescript
// Platform adapter interface
interface EcommercePlatformAdapter {
  // Product operations
  createProduct(product: NormalizedProduct): Promise<PlatformProduct>
  updateProduct(productId: string, product: NormalizedProduct): Promise<PlatformProduct>
  getProduct(productId: string): Promise<PlatformProduct>
  
  // Manufacturer operations
  createManufacturer(name: string): Promise<PlatformManufacturer>
  getManufacturers(): Promise<PlatformManufacturer[]>
  
  // Category operations
  createCategory(category: NormalizedCategory): Promise<PlatformCategory>
  
  // Order operations
  getOrders(filters: OrderFilters): Promise<PlatformOrder[]>
}

// Normalized data models (ERP internal)
interface NormalizedProduct {
  sku: string
  name: string
  price: number
  manufacturer_id: UUID // ERP manufacturer ID
  unit_id: UUID // ERP unit ID
  vat_id: UUID // ERP VAT ID
  // ... other fields
}

// Platform-specific implementations
class ShopRenterAdapter implements EcommercePlatformAdapter { ... }
class UnasAdapter implements EcommercePlatformAdapter { ... }
class ShopifyAdapter implements EcommercePlatformAdapter { ... }
class POSAdapter implements EcommercePlatformAdapter { ... }
```

**Migration Path:**
1. **Phase 1**: Keep existing ShopRenter code, add adapter interface
2. **Phase 2**: Refactor ShopRenter code to use adapter
3. **Phase 3**: Implement Unas adapter
4. **Phase 4**: Implement Shopify adapter
5. **Phase 5**: Implement POS adapter

---

## 📋 Step-by-Step Implementation Plan

### **Phase 1: Manufacturers (Current Priority)**
✅ **Status**: Ready to implement

**Steps:**
1. Create `manufacturers` table (global, like units)
2. Create `manufacturer_platform_mappings` table (optional, for tracking)
3. Create manufacturers API routes (`/api/manufacturers`)
4. Create manufacturers management page (same style as units/VAT)
5. Update product sync to auto-create manufacturers (like units)
6. Update product edit form to use manufacturers dropdown
7. Add to vertical menu and permissions
8. Update database template

**Benefits:**
- Consistent with units/VAT pattern
- Future-proof for multi-platform
- Better UX (create once, use everywhere)

---

### **Phase 2: Platform Abstraction (Future)**
**When**: Before adding Unas/Shopify support

**Steps:**
1. Define `EcommercePlatformAdapter` interface
2. Create `NormalizedProduct`, `NormalizedCategory` types
3. Refactor ShopRenter code to use adapter
4. Test with ShopRenter (ensure no regressions)
5. Ready for Unas/Shopify implementation

---

### **Phase 3: Additional Master Data (Future)**
**Consider making global:**
- **Product Classes** (if same across platforms)
- **Attributes** (size, color, etc. - if standardized)
- **Tags** (if same across platforms)

**Keep connection-specific:**
- Products
- Categories
- Orders
- Customers (maybe? depends on requirements)

---

## 🔒 Vendor Lock-In Strategies

### **1. Data Richness**
- Store more data than competitors
- Manufacturer logos, descriptions, websites
- Product history, sync logs, analytics
- Customer purchase history across all platforms

### **2. Seamless Multi-Platform Management**
- One dashboard for all platforms
- Unified product management
- Cross-platform inventory sync
- Unified reporting

### **3. Time Investment**
- Rich configuration options
- Custom fields, tags, attributes
- Automated workflows
- Custom reports

### **4. Integration Depth**
- Deep platform integrations
- Real-time sync
- Advanced features (SEO, analytics)
- POS integration

### **5. User Experience**
- Intuitive UI (no training needed)
- One-click operations
- Smart defaults
- Helpful error messages
- Auto-fix common issues

---

## 🎨 UI/UX Consistency

### **Master Data Management Pages (Units, VAT, Manufacturers)**
**Standard Pattern:**
- ✅ Compact table with checkbox selection (first column)
- ✅ Bulk actions (Edit/Delete) above table
- ✅ "New" button above table (no wrapping)
- ✅ Row click opens edit dialog
- ✅ Soft delete only
- ✅ No "Műveletek" column (actions in row click)

**Files to follow pattern:**
- `/units` - ✅ Done
- `/vat` - ✅ Done
- `/manufacturers` - ⏳ To implement

---

## 📝 Database Template Maintenance

### **🚨 CRITICAL RULE - NEVER FORGET:**
**EVERY SQL modification to the database MUST be added to:**
- `admin-portal/database-templates/tenant-database-template.sql`

**This includes:**
- ✅ Creating new tables
- ✅ Adding new columns
- ✅ Creating indexes
- ✅ Creating triggers
- ✅ Creating functions
- ✅ Creating RLS policies
- ✅ Adding permissions
- ✅ Adding sample data
- ✅ Any other database schema changes

**Why:**
- New tenants get all migrations automatically
- Single source of truth for database schema
- Prevents migration drift between tenants
- Ensures consistency across all tenant databases

**MANDATORY Checklist when adding ANY database modification:**
- [ ] Create migration file in `shop-portal/supabase/migrations/`
- [ ] **IMMEDIATELY add to `admin-portal/database-templates/tenant-database-template.sql`**
- [ ] Test on new tenant database
- [ ] Document in this file
- [ ] Verify the template includes ALL changes

**⚠️ WARNING:** If you forget to update the template, new tenants will be missing critical database changes, causing system failures and data inconsistencies!

---

## 🚀 Future Considerations

### **POS Integration**
- **Local store sales**: Different from e-commerce
- **Offline-first**: May need sync queue
- **Inventory**: Real-time vs. batch sync
- **Products**: Same products, different pricing?

### **Multi-Currency**
- **Global currencies table**: ✅ Already exists
- **Product pricing**: Per currency?
- **Exchange rates**: Auto-update?

### **Multi-Language**
- **Product descriptions**: Already handled (shoprenter_product_descriptions)
- **UI language**: User preference?
- **Content translation**: Auto-translate?

### **Analytics & Reporting**
- **Cross-platform sales**: Unified reporting
- **Product performance**: Best sellers across platforms
- **Customer analytics**: Purchase patterns
- **Inventory insights**: Stock levels, turnover

---

## ✅ Implementation Checklist: Manufacturers

- [ ] Create migration: `20250315_create_manufacturers_table.sql`
- [ ] Add to `tenant-database-template.sql`
- [ ] Create API route: `/api/manufacturers/route.ts` (GET, POST)
- [ ] Create API route: `/api/manufacturers/[id]/route.ts` (PUT, DELETE)
- [ ] Create page: `/manufacturers/page.tsx`
- [ ] Create component: `ManufacturersTable.tsx` (same style as UnitsTable)
- [ ] Add to vertical menu: `verticalMenuData.tsx`
- [ ] Add to permissions: Migration for `/manufacturers` page
- [ ] Update product sync: Auto-create manufacturers (like units)
- [ ] Update product edit form: Use manufacturers dropdown
- [ ] Update product sync (push): Use manufacturer mappings
- [ ] Test: Create manufacturer → use in product → sync to ShopRenter
- [ ] Test: Sync product from ShopRenter → auto-create manufacturer
- [ ] Test: Edit manufacturer → sync to ShopRenter

---

## 📚 Related Files

- `shop-portal/supabase/migrations/20250315_create_units_table.sql` - Reference implementation
- `shop-portal/src/app/(dashboard)/units/UnitsTable.tsx` - UI reference
- `shop-portal/src/app/api/units/route.ts` - API reference
- `admin-portal/database-templates/tenant-database-template.sql` - Template to update

---

**Next Steps:**
1. Review this document
2. Confirm manufacturers approach (global vs connection-specific)
3. Proceed with implementation when ready

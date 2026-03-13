# Order Management System - Complete Implementation Plan

## 📋 Executive Summary

This document provides a comprehensive, phase-by-phase plan for implementing a complete order management system that handles:
- Webhook-based order reception from ShopRenter
- Payment method handling
- Shipping method handling
- Stock checking and allocation
- Purchase order creation for out-of-stock items
- Order fulfillment workflow
- Manual order creation
- All edge cases and business logic

**Design Philosophy**: User-friendly, simple UI, but complete backend logic.

---

## 🎯 System Overview

### **Core Workflow (Based on Industry Best Practices):**
```
Webhook → Buffer → Review → Check Stock → Reserve → Create Order → Fulfill → Ship
```

### **Key Components:**
1. **Order Reception** (Webhook handler)
2. **Order Buffer** (Review area for web orders - like Thanaris)
3. **Stock Management** (Check, reserve, allocate)
4. **Fulfillability Checking** (Visual indicators: ✅ Fully, ⚠️ Partial, ❌ Not fulfillable)
5. **Purchase Order Integration** (Auto-create if needed)
6. **Payment Processing** (Track payment methods, prepaid status)
7. **Shipping Management** (Master data + tracking)
8. **Packing Verification** (Barcode scanning - future)
9. **Order Fulfillment** (Status workflow)
10. **Manual Order Creation** (Admin interface)

### **Key Insights from Thanaris (Industry Standard):**
- **Order Buffer**: Web orders go to buffer first for review before becoming actual orders
- **Fulfillability Indicators**: Clear visual status (✅ ⚠️ ❌) for each order/item
- **Stock Reservation**: Reserve stock when order created, auto-reallocate on cancel
- **Master Data**: Shipping and payment methods in separate master data tables
- **Packing Verification**: Barcode scanning to verify what's being packed
- **Shipping Labels**: Generated during packing verification
- **Payment Status**: Separate tracking for prepaid orders (before fulfillment)

---

## 📊 Database Schema (Complete)

### **1. `orders` Table:**
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    connection_id UUID REFERENCES webshop_connections(id),
    
    -- Order Identification
    order_number TEXT UNIQUE NOT NULL, -- ORD-YYYY-MM-DD-NNN
    platform_order_id TEXT, -- ShopRenter innerId
    platform_order_resource_id TEXT, -- ShopRenter resource ID
    invoice_number TEXT, -- From ShopRenter
    invoice_prefix TEXT,
    
    -- Customer Link
    customer_person_id UUID REFERENCES customer_persons(id),
    
    -- Customer Info (Snapshot at order time)
    customer_firstname TEXT NOT NULL,
    customer_lastname TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_group_id UUID REFERENCES customer_groups(id),
    
    -- Shipping Address
    shipping_firstname TEXT NOT NULL,
    shipping_lastname TEXT NOT NULL,
    shipping_company TEXT,
    shipping_address1 TEXT NOT NULL,
    shipping_address2 TEXT,
    shipping_city TEXT NOT NULL,
    shipping_postcode TEXT NOT NULL,
    shipping_country_code TEXT, -- ISO 2
    shipping_zone_name TEXT,
    shipping_method_id UUID REFERENCES shipping_methods(id), -- ERP shipping method
    shipping_method_name TEXT, -- Snapshot from ShopRenter
    shipping_method_code TEXT, -- WSESHIP, GLS, etc.
    shipping_method_extension TEXT, -- Extension type
    shipping_receiving_point_id TEXT, -- Pickup point ID
    shipping_net_price NUMERIC(10,2),
    shipping_gross_price NUMERIC(10,2),
    shipping_additional_cost_net NUMERIC(10,2) DEFAULT 0,
    shipping_additional_cost_gross NUMERIC(10,2) DEFAULT 0,
    expected_delivery_date DATE,
    tracking_number TEXT,
    
    -- Billing Address
    billing_firstname TEXT NOT NULL,
    billing_lastname TEXT NOT NULL,
    billing_company TEXT,
    billing_address1 TEXT NOT NULL,
    billing_address2 TEXT,
    billing_city TEXT NOT NULL,
    billing_postcode TEXT NOT NULL,
    billing_country_code TEXT, -- ISO 2
    billing_zone_name TEXT,
    billing_tax_number TEXT,
    
    -- Payment Info
    payment_method_id UUID REFERENCES payment_methods(id), -- ERP payment method
    payment_method_name TEXT, -- Snapshot from ShopRenter
    payment_method_code TEXT, -- COD, BANK_TRANSFER, etc.
    payment_method_after BOOLEAN DEFAULT true, -- true = pay later
    payment_net_price NUMERIC(10,2) DEFAULT 0,
    payment_gross_price NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending', -- pending, partial, paid, refunded
    payment_date TIMESTAMP,
    
    -- Order Totals
    subtotal_net NUMERIC(10,2) NOT NULL,
    subtotal_gross NUMERIC(10,2) NOT NULL,
    tax_amount NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) DEFAULT 0, -- Coupon + quantity discounts
    shipping_total_net NUMERIC(10,2) DEFAULT 0,
    shipping_total_gross NUMERIC(10,2) DEFAULT 0,
    payment_total_net NUMERIC(10,2) DEFAULT 0,
    payment_total_gross NUMERIC(10,2) DEFAULT 0,
    total_net NUMERIC(10,2) NOT NULL,
    total_gross NUMERIC(10,2) NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'HUF',
    
    -- Status & Workflow
    status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review, new, packing, shipped, delivered, cancelled, refunded
    platform_status_id TEXT, -- ShopRenter status ID
    platform_status_text TEXT, -- ShopRenter status text
    
    -- Stock & Fulfillment
    fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
    stock_reserved BOOLEAN DEFAULT false, -- Whether stock is reserved for this order
    warehouse_id UUID REFERENCES warehouses(id), -- Which warehouse fulfills
    fulfillment_date DATE, -- When order was fulfilled
    
    -- Additional Info
    customer_comment TEXT,
    internal_notes TEXT, -- ERP-only notes
    language_code TEXT DEFAULT 'hu',
    ip_address TEXT,
    cart_token TEXT,
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_used INTEGER DEFAULT 0,
    
    -- Timestamps
    order_date TIMESTAMP NOT NULL, -- From ShopRenter dateCreated
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT orders_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT orders_connection_fk FOREIGN KEY (connection_id) REFERENCES webshop_connections(id),
    CONSTRAINT orders_customer_fk FOREIGN KEY (customer_person_id) REFERENCES customer_persons(id),
    CONSTRAINT orders_status_check CHECK (status IN ('pending_review', 'new', 'packing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
    CONSTRAINT orders_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_connection_id ON orders(connection_id);
CREATE INDEX idx_orders_platform_order_id ON orders(connection_id, platform_order_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_person_id ON orders(customer_person_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_fulfillability_status ON orders(fulfillability_status);
CREATE INDEX idx_orders_stock_reserved ON orders(stock_reserved);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### **2. `order_items` Table:**
```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Product Link
    product_id UUID REFERENCES shoprenter_products(id), -- Nullable if product doesn't exist
    
    -- Product Info (Snapshot at order time)
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    product_model_number TEXT, -- Manufacturer part number
    product_gtin TEXT, -- Barcode
    product_image_url TEXT,
    product_category TEXT, -- Comma-separated
    
    -- Pricing (Snapshot)
    unit_price_net NUMERIC(10,2) NOT NULL,
    unit_price_gross NUMERIC(10,2) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL, -- e.g., 27.00
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total_net NUMERIC(10,2) NOT NULL,
    line_total_gross NUMERIC(10,2) NOT NULL,
    
    -- Physical Properties
    weight NUMERIC(10,3),
    weight_unit_id UUID REFERENCES weight_units(id),
    length NUMERIC(10,2),
    width NUMERIC(10,2),
    height NUMERIC(10,2),
    dimension_unit_id UUID REFERENCES units(id), -- Usually 'cm'
    
    -- Platform Info
    platform_order_item_id TEXT, -- ShopRenter orderProduct innerId
    platform_order_item_resource_id TEXT,
    
    -- Stock & Fulfillment
    fulfillability_status TEXT DEFAULT 'unknown', -- unknown, checking, fully_fulfillable, partially_fulfillable, not_fulfillable, po_created
    reserved_quantity INTEGER DEFAULT 0, -- How much is reserved from stock
    purchase_order_id UUID REFERENCES purchase_orders(id), -- If PO was created for this item
    purchase_order_item_id UUID REFERENCES purchase_order_items(id), -- Link to PO item
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, reserved, picked, packed, shipped, delivered, cancelled
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT order_items_status_check CHECK (status IN ('pending', 'reserved', 'picked', 'packed', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT order_items_fulfillability_status_check CHECK (fulfillability_status IN ('unknown', 'checking', 'fully_fulfillable', 'partially_fulfillable', 'not_fulfillable', 'po_created'))
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_fulfillability_status ON order_items(fulfillability_status);
CREATE INDEX idx_order_items_purchase_order_id ON order_items(purchase_order_id);
```

### **3. `order_item_options` Table:**
```sql
CREATE TABLE order_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_name TEXT NOT NULL, -- e.g., "Size", "Color"
    option_value TEXT NOT NULL, -- e.g., "Large", "Red"
    price_adjustment_net NUMERIC(10,2) DEFAULT 0, -- Can be negative
    price_adjustment_gross NUMERIC(10,2) DEFAULT 0,
    price_prefix TEXT CHECK (price_prefix IN ('+', '-')), -- + or -
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_item_options_order_item_id ON order_item_options(order_item_id);
```

### **4. `order_item_addons` Table:**
```sql
CREATE TABLE order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    addon_name TEXT NOT NULL,
    addon_sku TEXT,
    addon_type TEXT,
    unit_price_net NUMERIC(10,2) NOT NULL,
    unit_price_gross NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total_net NUMERIC(10,2) NOT NULL,
    line_total_gross NUMERIC(10,2) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_item_addons_order_item_id ON order_item_addons(order_item_id);
```

### **5. `order_totals` Table:**
```sql
CREATE TABLE order_totals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Subtotal", "VAT (27%)", "Shipping", "Total"
    value_net NUMERIC(10,2) NOT NULL,
    value_gross NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL, -- SUB_TOTAL, TAX, SUB_TOTAL_WITH_TAX, SHIPPING, PAYMENT, COUPON, DISCOUNT, TOTAL
    sort_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT order_totals_type_check CHECK (type IN ('SUB_TOTAL', 'TAX', 'SUB_TOTAL_WITH_TAX', 'SHIPPING', 'PAYMENT', 'COUPON', 'DISCOUNT', 'TOTAL'))
);

CREATE INDEX idx_order_totals_order_id ON order_totals(order_id);
CREATE INDEX idx_order_totals_type ON order_totals(type);
```

### **6. `order_status_history` Table:**
```sql
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- ERP status
    platform_status_id TEXT, -- ShopRenter status ID
    platform_status_text TEXT, -- ShopRenter status text
    comment TEXT,
    changed_by UUID REFERENCES users(id), -- If manual change
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'webhook', -- webhook, manual, api
    
    CONSTRAINT order_status_history_source_check CHECK (source IN ('webhook', 'manual', 'api'))
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_changed_at ON order_status_history(changed_at);
```

### **7. `order_payments` Table:**
```sql
CREATE TABLE order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL, -- Can be negative for refunds
    payment_method_id UUID REFERENCES payment_methods(id),
    payment_method_name TEXT, -- Snapshot
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    transaction_id TEXT, -- From credit card payment
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    CONSTRAINT order_payments_amount_check CHECK (amount != 0)
);

CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX idx_order_payments_payment_date ON order_payments(payment_date);
```

### **8. `order_platform_mappings` Table:**
```sql
CREATE TABLE order_platform_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES webshop_connections(id),
    platform_order_id TEXT NOT NULL, -- ShopRenter innerId
    platform_order_resource_id TEXT,
    last_synced_from_platform_at TIMESTAMP,
    last_synced_to_platform_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(connection_id, platform_order_id)
);

CREATE INDEX idx_order_platform_mappings_order_id ON order_platform_mappings(order_id);
CREATE INDEX idx_order_platform_mappings_connection_id ON order_platform_mappings(connection_id);
```

### **9. Supporting Tables (if not exist):**

#### **`shipping_methods` Table:**
```sql
CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL, -- Display name (e.g., "GLS csomagpont")
    code TEXT, -- Internal code (WSESHIP, GLS, etc.)
    extension TEXT, -- Extension type (GLSPARCELPOINT, etc.)
    icon_url TEXT, -- Icon/image URL for visual display
    requires_pickup_point BOOLEAN DEFAULT false, -- Whether pickup point ID is required
    supports_tracking BOOLEAN DEFAULT true, -- Whether tracking number can be added
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_shipping_methods_tenant_id ON shipping_methods(tenant_id);
CREATE INDEX idx_shipping_methods_code ON shipping_methods(tenant_id, code);
```

#### **`payment_methods` Table:**
```sql
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL, -- Display name (e.g., "Utánvét")
    code TEXT NOT NULL, -- COD, BANK_TRANSFER, etc.
    icon_url TEXT, -- Icon/image URL for visual display
    requires_prepayment BOOLEAN DEFAULT false, -- Whether prepayment is required
    payment_after_delivery BOOLEAN DEFAULT false, -- Whether payment is after delivery (COD)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_payment_methods_tenant_id ON payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_code ON payment_methods(tenant_id, code);
```

#### **`order_buffer` Table (Web Order Buffer - Like Thanaris):**
```sql
CREATE TABLE order_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    connection_id UUID NOT NULL REFERENCES webshop_connections(id),
    
    -- Platform Info
    platform_order_id TEXT NOT NULL, -- ShopRenter innerId
    platform_order_resource_id TEXT,
    
    -- Raw Webhook Data (JSONB for flexibility)
    webhook_data JSONB NOT NULL,
    
    -- Processing Status
    status TEXT DEFAULT 'pending', -- pending, processing, processed, failed, blacklisted
    processed_at TIMESTAMP,
    processed_by UUID REFERENCES users(id),
    error_message TEXT,
    
    -- Blacklist (if customer is blacklisted)
    is_blacklisted BOOLEAN DEFAULT false,
    blacklist_reason TEXT,
    
    -- Timestamps
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(connection_id, platform_order_id)
);

CREATE INDEX idx_order_buffer_tenant_id ON order_buffer(tenant_id);
CREATE INDEX idx_order_buffer_connection_id ON order_buffer(connection_id);
CREATE INDEX idx_order_buffer_status ON order_buffer(status);
CREATE INDEX idx_order_buffer_received_at ON order_buffer(received_at);
```

---

## 🔄 Complete Workflow (Detailed)

### **Phase 1: Webhook Reception & Buffer (Industry Standard - Like Thanaris)**

```
1. Webhook received at /api/webhooks/shoprenter
2. Validate webhook signature (if available)
3. Parse JSON payload
4. Check for duplicate in order_buffer (platform_order_id + connection_id)
5. If duplicate:
   - Compare timestamps
   - Update buffer entry if newer
   - Log duplicate attempt
6. If new:
   - Store in order_buffer table (status = 'pending')
   - Store raw webhook_data as JSONB
   - Set received_at timestamp
   - Proceed to Phase 2 (only if auto-processing enabled)
   
Note: Orders go to buffer first for review (like Thanaris). Admin can review and process manually, or auto-process if configured.
```

### **Phase 2: Customer Matching**

```
1. Check if customerId exists in webhook
2. If exists:
   - Look up in customer_platform_mappings
   - Link to customer_persons.id
3. If not exists:
   - Try to match by email
   - If match found: Link to customer_persons.id
   - If no match: customer_person_id = NULL (guest order)
4. Store customer snapshot data in order
```

### **Phase 3: Payment & Shipping Method Matching**

```
1. Payment Method:
   - Extract payment_method_code from webhook
   - Look up in payment_methods table (by code + tenant_id)
   - If found: Link payment_method_id
   - If not found: Create new payment_method (or use NULL)
   - Store snapshot data (name, code, prices)

2. Shipping Method:
   - Extract shipping_method_code/extension from webhook
   - Look up in shipping_methods table (by code/extension + tenant_id)
   - If found: Link shipping_method_id
   - If not found: Create new shipping_method (or use NULL)
   - Store snapshot data (name, code, extension, prices)
```

### **Phase 4: Stock Checking & Fulfillability (Industry Standard - Like Thanaris)**

```
For each order item:
1. Check if product_id exists (linked from SKU)
2. If product exists:
   a. Check stock in warehouse (from order.warehouse_id or default)
   b. Check available_quantity (considering reserved stock)
   c. Calculate fulfillability:
      - If available_quantity >= order_item.quantity:
         → order_item.fulfillability_status = 'fully_fulfillable' ✅
      - If 0 < available_quantity < order_item.quantity:
         → order_item.fulfillability_status = 'partially_fulfillable' ⚠️
      - If available_quantity = 0:
         → order_item.fulfillability_status = 'not_fulfillable' ❌
   d. If partially or not fulfillable:
      - Check if product has supplier
      - If supplier exists: Create PO (see Phase 5)
      - If no supplier: Flag for manual review
3. If product doesn't exist:
   - Set order_item.fulfillability_status = 'unknown'
   - Store snapshot data only
   - Flag for manual review

After all items checked:
- Set order.fulfillability_status based on items:
  - All 'fully_fulfillable' → 'fully_fulfillable' ✅
  - Mix of 'fully_fulfillable' and others → 'partially_fulfillable' ⚠️
  - All 'not_fulfillable' → 'not_fulfillable' ❌
  - Any 'po_created' → 'po_created'
  
Visual Indicators (UI):
- ✅ Green badge: Fully fulfillable
- ⚠️ Orange badge: Partially fulfillable
- ❌ Red badge: Not fulfillable
- 🔵 Blue badge: PO created (waiting for stock)
```

### **Phase 5: Stock Reservation & PO Creation (Industry Standard - Like Thanaris)**

```
For items with fulfillability_status = 'fully_fulfillable' or 'partially_fulfillable':
1. Reserve stock (if stock_reserved = true in order):
   - Create stock_reservation record (reserved_quantity)
   - Update warehouse_stock.reserved_quantity (not allocated yet)
   - Set order_item.reserved_quantity
   - Set order_item.status = 'reserved'
   - Stock is now reserved, not available for other orders
   - Note: Reservation happens when order is created (not in buffer)

For items with fulfillability_status = 'not_fulfillable' or 'partially_fulfillable':
1. Check if product has supplier:
   - Look up product_supplier_relationships
   - If supplier exists:
     a. Create purchase_order (if not exists for this order)
     b. Add purchase_order_item with needed quantity
     c. Link order_item.purchase_order_id and purchase_order_item_id
     d. Set order_item.fulfillability_status = 'po_created'
   - If no supplier:
     - Keep fulfillability_status = 'not_fulfillable'
     - Flag for manual review
     - Notify admin

Stock Reservation Rules (Like Thanaris):
- Reservation happens when order moves from buffer to actual order
- Reserved stock is not available for other orders
- On order cancellation: Release reserved stock, auto-reallocate to waiting orders (chronological)
- Reservation can be disabled per order (for review purposes)
```

### **Phase 6: Order Creation (From Buffer)**

```
1. Move from buffer to actual order:
   - Update order_buffer.status = 'processing'
   - Extract data from webhook_data JSONB

2. Generate order_number:
   - Format: ORD-YYYY-MM-DD-NNN
   - Check uniqueness
   - Increment if needed

3. Create order record:
   - Insert into orders table
   - status = 'new' (moved from 'pending_review')
   - All fields populated from webhook + processing

4. Create order_items:
   - Insert each product as order_item
   - Link to order.id
   - Set fulfillability_status from Phase 4

5. Create order_item_options:
   - Insert product options if any

6. Create order_item_addons:
   - Insert product addons if any

7. Create order_totals:
   - SUB_TOTAL (net, gross)
   - TAX (per rate)
   - SUB_TOTAL_WITH_TAX
   - SHIPPING
   - PAYMENT (if payment fee)
   - COUPON (if used)
   - DISCOUNT (if quantity discount)
   - TOTAL

8. Reserve stock (if stock_reserved = true):
   - Execute Phase 5 stock reservation
   - Set order.stock_reserved = true

9. Create order_status_history:
   - Initial status entry (from 'pending_review' to 'new')

10. Create order_platform_mappings:
    - Link to ShopRenter

11. Update order.fulfillability_status based on items

12. Update order_buffer:
    - Set status = 'processed'
    - Set processed_at = NOW()
    - Set processed_by = current user

13. Send notifications:
    - Email warehouse (if configured)
    - Dashboard notification
    - Slack/Teams (if configured)
```

### **Phase 7: Post-Creation Actions**

```
1. If order.fulfillability_status = 'fully_fulfillable':
   - Order ready for fulfillment
   - Status = 'new'
   - Visual indicator: ✅ Green badge

2. If order.fulfillability_status = 'partially_fulfillable':
   - Some items need PO
   - Order can be partially fulfilled
   - Status = 'new'
   - Visual indicator: ⚠️ Orange badge
   - Show breakdown: "X db készleten, Y db vár készletre"

3. If order.fulfillability_status = 'not_fulfillable':
   - Order waiting for stock
   - Status = 'new'
   - Visual indicator: ❌ Red badge
   - Admin notified

4. If order.fulfillability_status = 'po_created':
   - PO created, waiting for stock
   - Status = 'new'
   - Visual indicator: 🔵 Blue badge
   - Show PO link

5. If payment_method.requires_prepayment = true:
   - Check payment_status
   - If payment_status != 'paid':
     - Show payment pending badge
     - Order cannot be fulfilled until paid
     - Flag in UI

6. If order.stock_reserved = true:
   - Stock is reserved
   - Cannot be used by other orders
   - Show "Készlet lefoglalva" badge
```

---

## 📋 Implementation Phases (Revised Based on Industry Standards)

**Key Changes from Original Plan:**
1. ✅ Added **Order Buffer** system (like Thanaris) - web orders go to buffer first
2. ✅ Added **Fulfillability Status** with visual indicators (✅ ⚠️ ❌)
3. ✅ Changed from "allocation" to **"reservation"** (industry standard)
4. ✅ Added **auto-reallocation** on cancellation (like Thanaris)
5. ✅ Enhanced **payment method** tracking (prepaid blocking)
6. ✅ Enhanced **shipping method** master data (icons, settings)
7. ✅ Added **packing verification** (future: barcode scanning)
8. ✅ Added **shipping label generation** during packing

---

## 📋 Implementation Phases

### **Phase 1: Database & Core Infrastructure**
**Goal**: Set up database schema and basic infrastructure

**Tasks**:
1. Create all database tables (orders, order_items, etc.)
2. Create supporting tables (shipping_methods, payment_methods)
3. Create indexes
4. Create triggers (updated_at, payment_status calculation)
5. Create functions (order_number generation)
6. Update tenant-database-template.sql
7. Add RLS policies
8. Add to permissions system

**Deliverables**:
- Complete database schema
- Migration files
- Updated tenant template

---

### **Phase 2: Webhook Handler & Order Buffer (Industry Standard)**
**Goal**: Receive webhooks and store in buffer for review (like Thanaris)

**Tasks**:
1. Create `/api/webhooks/shoprenter` endpoint
2. Validate webhook (signature if available)
3. Parse JSON payload
4. Check for duplicates in order_buffer
5. Store in order_buffer table (status = 'pending')
6. Store raw webhook_data as JSONB
7. Auto-process option (if enabled in settings)
8. Error handling and logging
9. Webhook retry mechanism

**Deliverables**:
- Webhook endpoint
- Order buffer system
- Duplicate detection
- Error handling
- Auto-process configuration

---

### **Phase 3: Order Buffer Review & Processing**
**Goal**: Review web orders in buffer and process them (like Thanaris)

**Tasks**:
1. Create `/orders/buffer` page (web order review)
2. Display pending orders from buffer
3. Show fulfillability indicators (✅ ⚠️ ❌)
4. Bulk selection and processing
5. Individual order review
6. Blacklist customer option
7. Process to actual order
8. Customer matching logic (by ID, email)
9. Payment method matching/creation
10. Shipping method matching/creation
11. Store snapshot data
12. Handle guest orders

**Deliverables**:
- Order buffer review page
- Bulk processing
- Customer blacklist
- Customer linking
- Payment/shipping method management
- Snapshot data storage

---

### **Phase 4: Stock Checking & Fulfillability (Industry Standard)**
**Goal**: Check stock and determine fulfillability (like Thanaris)

**Tasks**:
1. Product lookup by SKU
2. Stock checking logic (warehouse integration, consider reserved stock)
3. Fulfillability calculation:
   - Fully fulfillable (✅)
   - Partially fulfillable (⚠️)
   - Not fulfillable (❌)
4. Visual indicators in UI
5. Update order_item.fulfillability_status
6. Update order.fulfillability_status
7. Show breakdown in tooltips

**Deliverables**:
- Stock checking system
- Fulfillability calculation
- Visual indicators (✅ ⚠️ ❌)
- Status updates

---

### **Phase 5: Stock Reservation & PO Creation (Industry Standard)**
**Goal**: Reserve stock and create POs for out-of-stock items (like Thanaris)

**Tasks**:
1. Stock reservation logic:
   - Reserve stock when order created (if enabled)
   - Update warehouse_stock.reserved_quantity
   - Set order_item.reserved_quantity
   - Set order.stock_reserved = true
2. Auto-reallocation on cancellation:
   - Release reserved stock
   - Reallocate to waiting orders (chronological)
3. PO creation for out-of-stock:
   - Check product-supplier relationships
   - Create purchase_order if needed
   - Add purchase_order_items
   - Link order_items to PO items
4. Handle multiple suppliers
5. Handle products without suppliers

**Deliverables**:
- Stock reservation system
- Auto-reallocation on cancel
- Auto PO creation
- Order-PO linking
- Supplier handling

---

### **Phase 6: Order Buffer Page (New - Industry Standard)**
**Goal**: Review and process web orders from buffer (like Thanaris)

**Tasks**:
1. Create `/orders/buffer` page
2. Display pending orders from order_buffer
3. Show fulfillability indicators (✅ ⚠️ ❌) per order
4. Bulk selection with checkbox
5. Bulk processing button
6. Individual order review modal
7. Blacklist customer option
8. Process to actual order
9. Filters (status, date, connection)
10. Search functionality

**Deliverables**:
- Order buffer review page
- Bulk processing
- Fulfillability indicators
- Customer blacklist

---

### **Phase 7: Order List & Detail Pages**
**Goal**: Display orders in user-friendly interface

**Tasks**:
1. Create `/orders` list page
2. Create `/orders/[id]` detail page
3. Implement search and filters
4. Status badges (color-coded)
5. Fulfillability badges (✅ ⚠️ ❌ 🔵)
6. Payment status badges
7. Order totals display
8. Order items table with fulfillability per item
9. Customer info display
10. Shipping/billing address display
11. Shipping method icon display
12. Payment method icon display

**Deliverables**:
- Order list page
- Order detail page
- Search and filters
- Visual status indicators
- Fulfillability indicators

---

### **Phase 8: Order Status Management**
**Goal**: Handle status changes and workflow

**Tasks**:
1. Status change UI (modal dialog)
2. Status validation (only valid transitions)
3. Status history display
4. Webhook status update handling
5. Push status to ShopRenter (optional)
6. Status-based button visibility

**Deliverables**:
- Status change interface
- Status history
- Workflow enforcement

---

### **Phase 9: Fulfillment Actions (Industry Standard - Like Thanaris)**
**Goal**: Pack, verify, ship, and track orders

**Tasks**:
1. "Start Packing" action
2. Stock deduction on packing (from reserved to actual)
3. Packing verification (future: barcode scanning)
4. Shipping label generation (during packing)
5. "Add Tracking" action
6. Tracking number storage
7. Courier service integration (future)
8. "Mark as Delivered" action
9. Email notifications (optional)

**Deliverables**:
- Packing workflow
- Packing verification (future)
- Shipping label generation
- Shipping tracking
- Delivery confirmation

---

### **Phase 10: Payment Management (Industry Standard)**
**Goal**: Track payments and update payment status (like Thanaris)

**Tasks**:
1. Payment recording UI
2. Payment history display
3. Payment status calculation (trigger)
4. Prepaid order handling:
   - Check if payment_method.requires_prepayment = true
   - Show payment pending badge if not paid
   - Block fulfillment until paid
5. Partial payment handling
6. Refund handling
7. Payment method tracking
8. Payment confirmation email (optional)

**Deliverables**:
- Payment tracking
- Payment history
- Auto payment status
- Prepaid order blocking

---

### **Phase 11: Manual Order Creation**
**Goal**: Allow admins to create orders manually

**Tasks**:
1. Create `/orders/new` page
2. Customer selection/search
3. Product selection/search
4. Quantity and price editing
5. Shipping method selection
6. Payment method selection
7. Order totals calculation
8. Order creation

**Deliverables**:
- Manual order creation
- Customer/product search
- Order calculation

---

### **Phase 12: Edge Cases & Error Handling**
**Goal**: Handle all edge cases gracefully

**Tasks**:
1. Duplicate order handling
2. Webhook failure handling
3. Stock check failure handling
4. PO creation failure handling
5. Customer creation failure handling
6. Product not found handling
7. Invalid data handling
8. Retry mechanisms
9. Manual sync button
10. Error notifications

**Deliverables**:
- Comprehensive error handling
- Retry mechanisms
- Manual recovery options

---

### **Phase 13: Reporting & Analytics**
**Goal**: Provide insights and reports

**Tasks**:
1. Order statistics dashboard
2. Revenue reports
3. Status distribution
4. Payment status reports
5. Stock status reports
6. Customer order history
7. Product sales reports

**Deliverables**:
- Dashboard widgets
- Reports
- Analytics

---

## 🎨 UI/UX Design Principles

### **1. Simplicity First**
- Maximum 4 statuses visible at once
- One action per button
- Clear labels (no technical jargon)

### **2. Visual Hierarchy**
- Important info at top (order number, status, total)
- Details in collapsible sections
- Color coding for status

### **3. Progressive Disclosure**
- Show essential info first
- Hide advanced options by default
- Expand on demand

### **4. Feedback**
- Loading states
- Success/error messages
- Confirmation dialogs for destructive actions

### **5. Mobile-Friendly**
- Responsive design
- Touch-friendly buttons
- Readable on small screens

---

## ⚠️ Edge Cases & Business Rules

### **1. Duplicate Orders**
- **Rule**: Same platform_order_id + connection_id = duplicate
- **Action**: Update existing order if newer timestamp
- **UI**: Show warning if duplicate detected

### **2. Product Not Found**
- **Rule**: SKU doesn't exist in ERP
- **Action**: Create order_item with snapshot data only
- **UI**: Flag with warning badge, allow manual linking later

### **3. Out of Stock / Not Fulfillable**
- **Rule**: Available quantity = 0
- **Action**: 
  - If supplier exists: Create PO
  - If no supplier: Flag for manual review
- **UI**: Show ❌ "Nem teljesíthető" badge (red), show PO link if created

### **4. Partial Stock / Partially Fulfillable**
- **Rule**: 0 < available quantity < ordered quantity
- **Action**: Reserve available, create PO for rest
- **UI**: Show ⚠️ "Részben teljesíthető" badge (orange), show breakdown in tooltip: "X db készleten, Y db vár készletre"

### **5. Multiple Suppliers**
- **Rule**: Different items need different suppliers
- **Action**: Create separate PO for each supplier
- **UI**: Show all POs in order detail

### **6. Payment Methods**
- **Rule**: COD = payment after delivery
- **Action**: payment_status = 'pending' until marked paid
- **UI**: Show payment status badge

### **7. Shipping Methods**
- **Rule**: Different methods have different costs
- **Action**: Store shipping cost in order
- **UI**: Show shipping method and cost

### **8. Guest Orders**
- **Rule**: No customer_person_id = guest
- **Action**: Store customer data in order only
- **UI**: Show "Vendég rendelés" badge

### **9. Order Cancellation (Industry Standard - Like Thanaris)**
- **Rule**: Can cancel before shipping
- **Action**: 
  - Release reserved stock if stock_reserved = true
  - Auto-reallocate released stock to waiting orders (chronological)
  - Cancel PO if created (or mark as cancelled)
  - Update status to 'cancelled'
- **UI**: "Rendelés törlése" button with confirmation modal
- **Option**: "Felszabaduló készlet lefoglalása várakozó rendelésekhez" checkbox (like Thanaris)

### **10. Order Updates from ShopRenter**
- **Rule**: order_status_change webhook
- **Action**: Update order status, add to history
- **UI**: Show status change in history

---

## 🔐 Security & Validation

### **1. Webhook Security**
- Verify signature (if ShopRenter provides)
- Rate limiting
- IP whitelist (if possible)
- HTTPS only

### **2. Data Validation**
- Required fields check
- Data type validation
- Business rule validation
- Totals match validation

### **3. Access Control**
- RLS policies per tenant
- Permission checks for actions
- Audit trail for changes

---

## 📊 Performance Considerations

### **1. Database Indexes**
- All foreign keys indexed
- Status fields indexed
- Date fields indexed
- Search fields indexed

### **2. Query Optimization**
- Eager loading for relationships
- Pagination for lists
- Caching for static data (methods, statuses)

### **3. Background Jobs**
- Stock checking (async if slow)
- PO creation (async if slow)
- Email notifications (async)

---

## 🧪 Testing Strategy

### **1. Unit Tests**
- Order creation logic
- Stock checking logic
- PO creation logic
- Status transitions

### **2. Integration Tests**
- Webhook reception
- Full order flow
- Stock allocation
- PO creation

### **3. E2E Tests**
- Manual order creation
- Status changes
- Payment recording
- Fulfillment workflow

---

## 📝 Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize phases** based on business needs
3. **Start with Phase 1** (Database)
4. **Iterate** based on feedback

---

---

## 🎯 Key Improvements Based on Thanaris Analysis

### **1. Order Buffer System (Industry Standard)**
- **Why**: Allows review before committing to actual orders
- **How**: Web orders go to `order_buffer` table first
- **UI**: Separate `/orders/buffer` page for review
- **Benefit**: Catch issues before they become orders

### **2. Fulfillability Indicators (Visual & Clear)**
- **Why**: Users need to see at a glance if order can be fulfilled
- **How**: ✅ ⚠️ ❌ badges per order and item
- **UI**: Color-coded, tooltip with details
- **Benefit**: No confusion, instant understanding

### **3. Stock Reservation (Not Allocation)**
- **Why**: Industry standard - reserve stock, allocate later
- **How**: `stock_reserved` flag, `reserved_quantity` per item
- **UI**: Show "Készlet lefoglalva" badge
- **Benefit**: Clear separation between reserved and allocated

### **4. Auto-Reallocation on Cancel**
- **Why**: Like Thanaris - automatically reallocate to waiting orders
- **How**: On cancel, release reserved stock, reallocate chronologically
- **UI**: Checkbox option "Felszabaduló készlet lefoglalása várakozó rendelésekhez"
- **Benefit**: Efficient stock management

### **5. Master Data Tables**
- **Why**: Shipping and payment methods need management
- **How**: Separate tables with icons, settings
- **UI**: Management pages under "Törzsadatok"
- **Benefit**: Centralized management, consistent across orders

### **6. Prepaid Order Blocking**
- **Why**: Like Thanaris - can't fulfill until paid
- **How**: Check `payment_method.requires_prepayment`
- **UI**: Payment pending badge, block fulfillment actions
- **Benefit**: Prevents fulfillment of unpaid orders

### **7. Packing Verification (Future)**
- **Why**: Industry standard - verify what's being packed
- **How**: Barcode scanning during packing
- **UI**: Packing verification page
- **Benefit**: Accuracy, error prevention

---

**Document Version**: 2.0  
**Last Updated**: 2025-01-XX  
**Status**: Revised Plan - Based on Industry Standards (Thanaris Analysis) - Ready for Implementation

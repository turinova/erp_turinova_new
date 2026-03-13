# Order Management System - Testing Guide

## Prerequisites

### 1. Database Migrations

#### Admin Database Migration
Run this in your **ADMIN DATABASE** (separate Supabase project):
```sql
-- File: shop-portal/supabase/migrations/20250130_create_tenant_connection_mappings.sql
-- This creates the tenant_connection_mappings table in admin database
```

#### Tenant Database Migration
Run this in your **TENANT DATABASE**:
```sql
-- File: shop-portal/supabase/migrations/20250130_create_order_management_system.sql
-- This creates all order management tables (orders, order_items, order_buffer, etc.)
```

#### Permissions Migration
Run this in your **TENANT DATABASE**:
```sql
-- File: shop-portal/supabase/migrations/20250130_add_order_management_pages_to_permissions.sql
-- This adds order management pages to permissions system
```

### 2. Environment Variables

Make sure these are set in your `.env.local`:
```env
# Admin Database (for webhook routing)
ADMIN_SUPABASE_URL=https://your-admin-project.supabase.co
ADMIN_SUPABASE_SERVICE_ROLE_KEY=your-admin-service-role-key

# Tenant Database (current tenant)
NEXT_PUBLIC_SUPABASE_URL=https://your-tenant-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-tenant-anon-key
```

### 3. Sync Connection Mappings

After creating/updating a ShopRenter connection, sync it to admin database:

```bash
# POST /api/admin/sync-connection-mappings
curl -X POST http://localhost:3000/api/admin/sync-connection-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "your-tenant-uuid"
  }'
```

Or use the UI (if implemented) or run this manually after each connection creation.

## Testing Workflow

### Step 1: Test Webhook Endpoint (Health Check)

```bash
curl http://localhost:3000/api/webhooks/shoprenter
```

Expected response:
```json
{
  "status": "ok",
  "message": "ShopRenter webhook endpoint is active",
  "endpoint": "/api/webhooks/shoprenter",
  "method": "POST",
  "events": ["order_confirm", "order_status_change"]
}
```

### Step 2: Test Webhook Reception

Send a test webhook payload:

```bash
curl -X POST http://localhost:3000/api/webhooks/shoprenter \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "vasalatmester",
    "orders": {
      "order": [{
        "innerId": "12345",
        "innerResourceId": "orders/12345",
        "dateCreated": "2025-01-30T10:00:00Z",
        "firstname": "Test",
        "lastname": "User",
        "email": "test@example.com",
        "phone": "+36123456789",
        "total": "10000",
        "currency": {
          "code": "HUF"
        },
        "shippingFirstname": "Test",
        "shippingLastname": "User",
        "shippingAddress1": "Test Street 1",
        "shippingCity": "Budapest",
        "shippingPostcode": "1000",
        "shippingCountryName": "HU",
        "paymentFirstname": "Test",
        "paymentLastname": "User",
        "paymentAddress1": "Test Street 1",
        "paymentCity": "Budapest",
        "paymentPostcode": "1000",
        "paymentCountryName": "HU"
      }]
    }
  }'
```

**Important**: Make sure:
1. The `storeName` or `api_url` matches a connection in `tenant_connection_mappings`
2. The connection mapping exists in admin database (use sync endpoint)

Expected response:
```json
{
  "success": true,
  "message": "Order received and stored in buffer",
  "order_id": "buffer-entry-uuid",
  "connection_id": "connection-uuid",
  "tenant_id": "tenant-uuid",
  "action": "created"
}
```

### Step 3: List Buffer Entries

```bash
curl http://localhost:3000/api/orders/buffer?status=pending
```

Expected response:
```json
{
  "success": true,
  "entries": [
    {
      "id": "buffer-entry-uuid",
      "connection_id": "connection-uuid",
      "platform_order_id": "12345",
      "status": "pending",
      "received_at": "2025-01-30T10:00:00Z",
      "connection": {
        "id": "connection-uuid",
        "name": "ShopRenter Connection",
        "api_url": "http://vasalatmester.api.myshoprenter.hu"
      },
      "order_summary": {
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "total": "10000",
        "currency": "HUF"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

### Step 4: Get Buffer Entry Details

```bash
curl http://localhost:3000/api/orders/buffer/{buffer-id}
```

Expected response:
```json
{
  "success": true,
  "entry": {
    "id": "buffer-entry-uuid",
    "connection_id": "connection-uuid",
    "platform_order_id": "12345",
    "webhook_data": { /* full webhook payload */ },
    "status": "pending",
    "received_at": "2025-01-30T10:00:00Z",
    "webshop_connections": {
      "id": "connection-uuid",
      "name": "ShopRenter Connection",
      "api_url": "http://vasalatmester.api.myshoprenter.hu"
    }
  }
}
```

### Step 5: Process Buffer Entry (Create Order)

```bash
curl -X POST http://localhost:3000/api/orders/buffer/{buffer-id}/process
```

Expected response:
```json
{
  "success": true,
  "message": "Order created successfully",
  "order_id": "order-uuid",
  "order_number": "ORD-2025-01-30-001",
  "items_count": 0
}
```

**Note**: If order products are not in webhook payload, `items_count` will be 0. You'll need to fetch them separately via ShopRenter API (Phase 3).

### Step 6: Verify Order Created

Check the `orders` table in your tenant database:
```sql
SELECT * FROM orders WHERE id = 'order-uuid';
```

Check order items:
```sql
SELECT * FROM order_items WHERE order_id = 'order-uuid';
```

## Common Issues

### Issue 1: "Could not find tenant for this webhook"

**Solution**: 
1. Make sure connection mapping exists in admin database
2. Run sync endpoint: `POST /api/admin/sync-connection-mappings`
3. Verify `api_url` or `store_name` matches webhook payload

### Issue 2: "Could not identify webshop connection"

**Solution**:
1. Check if connection exists in tenant database
2. Verify connection is active (`is_active = true`)
3. Check connection type is `shoprenter`

### Issue 3: "Failed to create order"

**Solution**:
1. Check database migration ran successfully
2. Verify all required fields are in webhook payload
3. Check database constraints (e.g., `order_number` uniqueness)

### Issue 4: Duplicate webhook received

**Solution**: This is handled automatically. The system will:
- Update existing buffer entry if newer
- Ignore duplicate if older
- Return appropriate response

## Next Steps

After testing:
1. **Phase 3**: Implement Order Buffer Review UI
2. **Phase 4**: Implement Stock Checking & Fulfillability
3. **Phase 5**: Implement Purchase Order Integration

## Manual Testing Checklist

- [ ] Admin database migration ran successfully
- [ ] Tenant database migration ran successfully
- [ ] Permissions migration ran successfully
- [ ] Connection mapping synced to admin database
- [ ] Webhook health check works
- [ ] Webhook reception works
- [ ] Buffer entry created successfully
- [ ] Buffer entry listing works
- [ ] Buffer entry details work
- [ ] Buffer entry processing works
- [ ] Order created successfully
- [ ] Order items created (if in webhook payload)
- [ ] Duplicate webhook handling works

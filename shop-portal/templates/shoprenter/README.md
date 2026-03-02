# ShopRenter Template Files

This directory contains ShopRenter template files that need to be integrated into your ShopRenter theme.

## Files

- `product.tpl` - Enhanced product page template with multi-tenant structured data support

## Installation

### Step 1: Copy the Template File

Copy `product.tpl` to your ShopRenter theme directory:

```
your-shoprenter-theme/product/product.tpl
```

**Important**: This will replace your existing `product.tpl` file. Make sure to backup your current template first!

### Step 2: Update Tenant Slug (if needed)

The template has the tenant slug hardcoded as `'tenant-1'`. If your tenant slug is different:

1. Open `product.tpl` in your ShopRenter theme
2. Find this line (around line 17):
   ```javascript
   const TENANT_SLUG = 'tenant-1'; // Hardcoded tenant slug - change this if needed
   ```
3. Replace `'tenant-1'` with your actual tenant slug (e.g., `'your-tenant-slug'`)

**Important**: The tenant slug must match the `slug` field in the `tenants` table in your Admin Database.

### Step 3: Verify

1. Access a product page on your ShopRenter store
2. Open your browser's developer console
3. Check the network requests - you should see a request to:
   ```
   https://shop.turinova.hu/api/shoprenter/structured-data/YOUR_SKU.jsonld?tenant=your-tenant-slug
   ```
4. Check the console logs for:
   ```
   [Enhanced Schema] ✅ Injected enhanced structured data for SKU: YOUR_SKU (tenant: your-tenant-slug)
   ```

## Features

- **Multi-tenant support**: Automatically includes tenant parameter in API calls
- **Schema replacement**: Removes ShopRenter's default Product schema and injects enhanced structured data
- **MutationObserver**: Catches and removes schemas added dynamically
- **Error handling**: Gracefully handles API failures without breaking the page

## Troubleshooting

- **400 Error (Tenant identification required)**: Check that `TENANT_SLUG` is set correctly in the template file (line 17). It should not be an empty string.
- **404 Error (Tenant not found)**: Double-check that the hardcoded `TENANT_SLUG` value in the template matches an active tenant's slug in your Admin Database. Verify the slug in the Admin Portal or query the Admin Database directly.
- **500 Error (Internal server error)**: Check the `shop-portal` server logs for more details
- **No structured data appearing**: Verify the script is loaded in `page_head` and that `ShopRenter.product.sku` is available. Check for JavaScript errors in the console

## Finding Your Tenant Slug

To find your tenant slug:

1. Log into the Admin Portal (`admin.turinova.hu`)
2. Go to "Ügyfelek" (Tenants)
3. Find your tenant in the list
4. The "Slug" column shows the tenant slug (e.g., `tenant-1`, `first-tenant`)

Alternatively, query the Admin Database directly:

```sql
SELECT id, name, slug FROM tenants WHERE is_active = true AND deleted_at IS NULL;
```

## Backward Compatibility

The template uses a hardcoded tenant slug. If you need to support multiple tenants from the same ShopRenter installation, you would need to either:
- Use a different template file per tenant, or
- Modify the template to accept the tenant slug from a ShopRenter controller variable (requires controller access)

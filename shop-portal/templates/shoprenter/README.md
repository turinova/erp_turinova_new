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

### Step 2: Add Tenant Slug to Controller

In your ShopRenter product controller (typically `catalog/product.php` or similar), add the tenant slug to the template data:

```php
// Add this to your $data array before rendering the template
$data['tenant_slug'] = 'your-tenant-slug'; // Replace with your actual tenant slug from Admin DB

// Or if you have a config/constant:
// Define this in your ShopRenter config file
define('TURINOVA_TENANT_SLUG', 'your-tenant-slug');
$data['tenant_slug'] = TURINOVA_TENANT_SLUG;
```

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

- **400 Error (Tenant identification required)**: Ensure `tenant_slug` is correctly set in your ShopRenter controller and passed to the template
- **404 Error (Tenant not found)**: Double-check that the `tenant_slug` matches an active tenant's slug in your Admin Database
- **500 Error (Internal server error)**: Check the `shop-portal` server logs for more details
- **No structured data appearing**: Verify the script is loaded in `page_head` and that `ShopRenter.product.sku` is available. Check for JavaScript errors in the console

## Backward Compatibility

If `tenant_slug` is not provided (empty string), the API will attempt to use session-based tenant context as a fallback. However, for public ShopRenter requests, the tenant parameter is **required** for proper multi-tenant isolation.

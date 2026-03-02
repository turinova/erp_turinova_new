# ShopRenter Template Setup for Multi-Tenant Structured Data

## Overview

The structured data endpoint now requires tenant identification via a query parameter. This ensures that public requests from ShopRenter frontend query the correct tenant database.

## API Endpoint Changes

The endpoint `/api/shoprenter/structured-data/[sku]` now accepts an optional `tenant` query parameter:

```
GET /api/shoprenter/structured-data/CSF106.jsonld?tenant=tenant-1
```

If the `tenant` parameter is provided:
- The system looks up the tenant in the Admin Database by slug
- Creates a Supabase client for that tenant's database
- Queries the product from the correct tenant database

If the `tenant` parameter is **not** provided:
- The system falls back to session-based tenant context (for backward compatibility)
- If no session exists, returns a 400 error asking for tenant parameter

## ShopRenter Template Modification

### Step 1: Add Tenant Slug Variable

In your ShopRenter controller (where you render the product page), add the tenant slug to the template data:

```php
// In your ShopRenter product controller (e.g., catalog/product.php)
// Add this to your $data array before rendering the template

$data['tenant_slug'] = 'tenant-1'; // Replace with your actual tenant slug from Admin DB

// Or if you have a config/constant:
// Define this in your ShopRenter config file
define('TURINOVA_TENANT_SLUG', 'tenant-1');
$data['tenant_slug'] = TURINOVA_TENANT_SLUG;
```

**Important**: The tenant slug must match the `slug` field in the `tenants` table in your Admin Database.

### Step 2: Update the Template Script

In your ShopRenter template file (e.g., `layout/1-column-no-container-layout.tpl` or wherever you have the structured data script), modify the JavaScript:

**Find this section:**
```javascript
const API_URL = 'https://shop.turinova.hu';
const sku = ShopRenter.product.sku;

fetch(`${API_URL}/api/shoprenter/structured-data/${encodeURIComponent(sku)}.jsonld`)
```

**Replace with:**
```javascript
const API_URL = 'https://shop.turinova.hu';
const TENANT_SLUG = '{{ tenant_slug|default('') }}'; // Add this variable
const sku = ShopRenter.product.sku;

// Build API URL with tenant parameter if available
let apiUrl = `${API_URL}/api/shoprenter/structured-data/${encodeURIComponent(sku)}.jsonld`;
if (TENANT_SLUG) {
    apiUrl += `?tenant=${encodeURIComponent(TENANT_SLUG)}`;
}

fetch(apiUrl)
```

### Complete Template Example

Here's the complete modified section:

```twig
{% block page_head %}
    <script type="application/ld+json" id="enhanced-structured-data"></script>
    <script>
    (function() {
        'use strict';
        
        const API_URL = 'https://shop.turinova.hu';
        const TENANT_SLUG = '{{ tenant_slug|default('') }}'; // Tenant slug from controller
        let schemaReplaced = false;
        
        // ... existing removeDefaultSchemasImmediately function ...
        
        function replaceSchema() {
            if (schemaReplaced) {
                return;
            }
            
            removeDefaultSchemasImmediately();
            
            if (typeof ShopRenter === 'undefined' || !ShopRenter.product || !ShopRenter.product.sku) {
                setTimeout(replaceSchema, 100);
                return;
            }
            
            const sku = ShopRenter.product.sku;
            
            // Build API URL with tenant parameter if available
            let apiUrl = `${API_URL}/api/shoprenter/structured-data/${encodeURIComponent(sku)}.jsonld`;
            if (TENANT_SLUG) {
                apiUrl += `?tenant=${encodeURIComponent(TENANT_SLUG)}`;
            }
            
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(jsonLd => {
                    removeDefaultSchemasImmediately();
                    
                    const script = document.getElementById('enhanced-structured-data');
                    if (script && jsonLd) {
                        script.textContent = JSON.stringify(jsonLd);
                        schemaReplaced = true;
                        console.log('[Enhanced Schema] ✅ Injected enhanced structured data for SKU:', sku);
                    }
                })
                .catch(error => {
                    console.error('[Enhanced Schema] ❌ Failed to load:', error);
                });
        }
        
        // Start immediately
        replaceSchema();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', replaceSchema);
        } else {
            replaceSchema();
        }
        
        setTimeout(replaceSchema, 500);
        setTimeout(replaceSchema, 1000);
    })();
    </script>
{% endblock %}
```

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

## Testing

After making the changes:

1. **Test with tenant parameter:**
   ```
   https://shop.turinova.hu/api/shoprenter/structured-data/CSF106.jsonld?tenant=tenant-1
   ```
   Should return structured data for the product.

2. **Test without tenant parameter (should fail gracefully):**
   ```
   https://shop.turinova.hu/api/shoprenter/structured-data/CSF106.jsonld
   ```
   Should return a 400 error asking for tenant parameter.

3. **Test on actual ShopRenter product page:**
   - Open a product page on your ShopRenter store
   - Check browser console for `[Enhanced Schema] ✅` message
   - Verify structured data is injected correctly

## Troubleshooting

### Error: "Tenant not found"
- Verify the tenant slug matches exactly (case-sensitive)
- Check that the tenant is active (`is_active = true`)
- Check that the tenant is not deleted (`deleted_at IS NULL`)

### Error: "Tenant identification required"
- Make sure `tenant_slug` is being passed to the template
- Check that the Twig variable `{{ tenant_slug }}` is rendering correctly
- Verify the JavaScript variable `TENANT_SLUG` is not empty

### Structured data not loading
- Check browser console for errors
- Verify the API URL is correct
- Check network tab to see the actual request being made
- Verify the tenant slug in the request URL matches your Admin DB

## Backward Compatibility

The endpoint still supports session-based tenant context for backward compatibility:
- If a user is logged into the shop-portal and makes a request, it will use their session tenant context
- This is useful for testing and internal requests

However, for public ShopRenter frontend requests, the `tenant` parameter is required.

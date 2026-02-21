# Schema Removal Solution - Root Cause Analysis & Fix

## Problem Summary
Both ShopRenter's default Product/ProductGroup schema AND our enhanced API schema were appearing in the page, causing duplicate schemas when tested with Google's Schema Validator.

## Root Causes Identified

1. **Timing Issue**: ShopRenter's schema is generated server-side (in the initial HTML) or injected very early in the page load, before our removal script could run.

2. **Incomplete Removal**: The previous removal script only ran at specific times and didn't catch schemas added later.

3. **Re-injection**: ShopRenter might be adding the schema back after our script removes it.

4. **Multiple Injection Points**: ShopRenter may inject schema in multiple locations (head, body, via JavaScript).

5. **MutationObserver Limitations**: The previous observer wasn't aggressive enough and didn't catch all cases.

## Solution Implemented

### Key Improvements:

1. **Immediate Execution**: Script runs IMMEDIATELY, even before DOM is ready, using inline script in `header.tpl`.

2. **Dual MutationObservers**:
   - **Removal Observer**: Continuously monitors and removes any Product/ProductGroup schemas
   - **Injection Observer**: Specifically watches for new script tags being added and prevents Product schemas from being injected

3. **Aggressive Removal**: 
   - Checks both `<head>` and `<body>`
   - Removes schemas immediately when detected
   - Runs multiple times with delays to catch late-loading schemas

4. **Persistent Monitoring**: 
   - Observers run continuously throughout page lifecycle
   - Also monitors `window.load` event
   - Multiple retry attempts with increasing delays

5. **Schema Identification**: 
   - Checks for `@type: "Product"` or `@type: "ProductGroup"`
   - Also checks for string patterns as fallback
   - Skips our enhanced schema (marked with `id="enhanced-structured-data"` or `data-enhanced="true"`)

6. **Priority Injection**: Our schema is injected at the beginning of `<head>` for maximum priority.

## Implementation

### File: `HEADER_TPL_SCHEMA_REMOVAL_CODE.txt`

This file contains the complete `header.tpl` code with the enhanced schema removal script at the very top (right after the `{% if section.settings.status %}` check).

### Key Code Block (to add at top of header.tpl):

```twig
{% if section.settings.status %}
    {# Enhanced Structured Data - MUST BE FIRST #}
    <script type="application/ld+json" id="enhanced-structured-data"></script>
    <script>
    (function() {
        'use strict';
        // ... enhanced removal and injection logic ...
    })();
    </script>
    
    {{ language('common/header') }}
    <!-- rest of header code -->
```

## How to Apply

1. **Go to ShopRenter Admin** → Appearance → Theme File Editor
2. **Navigate to**: `common/header.tpl`
3. **Add the enhanced script block** at the very top (right after `{% if section.settings.status %}`)
4. **Save** the file
5. **Test** with Google Schema Validator to verify only our schema appears

## Testing Checklist

- [ ] Open a product page in ShopRenter
- [ ] View page source and search for `application/ld+json`
- [ ] Verify only ONE schema block exists (ours with `id="enhanced-structured-data"`)
- [ ] Test with Google Rich Results Test: https://search.google.com/test/rich-results
- [ ] Verify only our enhanced schema is detected
- [ ] Check browser console for `[Enhanced Schema]` logs
- [ ] Verify no errors in console

## Expected Behavior

1. **On Page Load**: 
   - Script runs immediately
   - Removes any ShopRenter schemas present in initial HTML
   - Sets up continuous monitoring

2. **During Page Load**:
   - MutationObservers catch any schemas added dynamically
   - Schemas are removed immediately

3. **After ShopRenter Loads**:
   - Our script fetches enhanced schema from API
   - Injects it into the page
   - Final cleanup removes any remaining ShopRenter schemas

4. **Result**: Only our enhanced schema remains in the page

## Troubleshooting

### If both schemas still appear:

1. **Check script placement**: Ensure the script is at the VERY TOP of `header.tpl`, before any other content
2. **Check console logs**: Look for `[Enhanced Schema]` messages
3. **Verify API URL**: Ensure `API_URL` is correct (`https://shop.turinova.hu`)
4. **Check network tab**: Verify API call to `/api/shoprenter/structured-data/[sku].jsonld` succeeds
5. **Inspect page source**: Search for `application/ld+json` and count how many exist

### If no schema appears:

1. **Check API endpoint**: Verify the API is accessible and returns valid JSON-LD
2. **Check ShopRenter object**: Ensure `ShopRenter.product.sku` is available
3. **Check console errors**: Look for fetch errors or JavaScript errors
4. **Verify script execution**: Check if script runs (add `console.log` at start)

## Additional Notes

- The script uses ES5-compatible JavaScript (no arrow functions) for maximum browser compatibility
- The script is self-contained and doesn't require external dependencies
- The script gracefully handles cases where ShopRenter object isn't available yet
- Multiple retry attempts ensure we catch schemas even if they load late

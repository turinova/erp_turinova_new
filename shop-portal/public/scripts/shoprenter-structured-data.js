/**
 * ShopRenter Enhanced Structured Data Injector
 * 
 * This script is injected into ShopRenter product pages via Script Tag API.
 * It fetches enhanced JSON-LD structured data from our API and injects it into the page.
 * 
 * Usage: This script should be hosted and referenced via ShopRenter Script Tag API.
 */

(function() {
  'use strict';

  /**
   * Get API base URL from script src URL query parameter or extract from script URL
   */
  function getApiBaseUrl() {
    // Find this script tag
    const scripts = document.querySelectorAll('script[src*="shoprenter-structured-data.js"]');
    
    for (let script of scripts) {
      const scriptSrc = script.getAttribute('src') || '';
      
      // Try to get apiUrl from query parameter
      try {
        const url = new URL(scriptSrc);
        const apiUrl = url.searchParams.get('apiUrl');
        if (apiUrl) {
          return apiUrl.replace(/\/$/, ''); // Remove trailing slash
        }
        
        // Fallback: extract origin from script URL (if hosted on our domain)
        return url.origin;
      } catch (e) {
        // Invalid URL, try next script
        continue;
      }
    }
    
    // Last resort: return empty (will cause error, but better than wrong URL)
    console.warn('[ShopRenter Structured Data] Could not determine API base URL. Please add ?apiUrl=... query parameter to script URL.');
    return '';
  }

  /**
   * Check if we're on a product page
   */
  function isProductPage() {
    if (typeof ShopRenter === 'undefined') {
      return false;
    }
    
    // Check if product object exists (only available on product pages)
    if (!ShopRenter.product || !ShopRenter.product.sku) {
      return false;
    }

    // Also check route if available
    if (ShopRenter.page && ShopRenter.page.route) {
      return ShopRenter.page.route === 'product/product';
    }

    return true; // If product exists, assume product page
  }

  /**
   * Get product identifier (prefer SKU, fallback to ID)
   */
  function getProductIdentifier() {
    if (!ShopRenter || !ShopRenter.product) {
      return null;
    }

    // Prefer SKU as it's more stable
    if (ShopRenter.product.sku) {
      return ShopRenter.product.sku;
    }

    // Fallback to ID
    if (ShopRenter.product.id) {
      return ShopRenter.product.id;
    }

    return null;
  }

  /**
   * Check if structured data already exists
   */
  function hasExistingStructuredData() {
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    // Check if any existing script contains our product data
    for (let script of existingScripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data['@type'] === 'Product' && data.sku) {
          // Check if it's our enhanced version (has additionalProperty)
          if (data.additionalProperty && Array.isArray(data.additionalProperty)) {
            return true;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    return false;
  }

  /**
   * Inject JSON-LD structured data into page
   */
  function injectStructuredData(jsonLd) {
    // Remove any existing enhanced structured data we may have added
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"][data-enhanced="true"]');
    existingScripts.forEach(script => script.remove());

    // Create new script tag
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-enhanced', 'true');
    script.textContent = JSON.stringify(jsonLd);

    // Insert into head (preferred location for structured data)
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      head.appendChild(script);
    } else {
      // Fallback to body if head not available
      document.body.appendChild(script);
    }
  }

  /**
   * Fetch structured data from API
   */
  function fetchStructuredData(productIdentifier) {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      console.error('[ShopRenter Structured Data] Cannot determine API base URL');
      return Promise.resolve(null);
    }
    
    const url = `${apiBaseUrl}/api/shoprenter/structured-data/${encodeURIComponent(productIdentifier)}.jsonld`;

    return fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/ld+json, application/json'
      },
      cache: 'default'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('[ShopRenter Structured Data] Failed to fetch structured data:', error);
      return null;
    });
  }

  /**
   * Main execution
   */
  function init() {
    // Wait for ShopRenter object to be available
    if (typeof ShopRenter === 'undefined') {
      // Retry after a short delay
      setTimeout(init, 100);
      return;
    }

    // Check if we're on a product page
    if (!isProductPage()) {
      return;
    }

    // Check if we already have enhanced structured data
    if (hasExistingStructuredData()) {
      return;
    }

    // Get product identifier
    const productIdentifier = getProductIdentifier();
    if (!productIdentifier) {
      console.warn('[ShopRenter Structured Data] No product identifier found');
      return;
    }

    // Fetch and inject structured data
    fetchStructuredData(productIdentifier)
      .then(jsonLd => {
        if (jsonLd) {
          injectStructuredData(jsonLd);
        }
      })
      .catch(error => {
        console.error('[ShopRenter Structured Data] Error:', error);
      });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Also try after a delay in case ShopRenter loads later
  setTimeout(init, 500);
})();

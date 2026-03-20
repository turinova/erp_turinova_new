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
   * Remove previously injected enhanced schemas only.
   * Never remove native ShopRenter Product/ProductGroup schemas.
   */
  function removeExistingProductStructuredData() {
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let removedCount = 0;
    
    existingScripts.forEach(script => {
      try {
        if (script.hasAttribute('data-enhanced')) {
          script.remove();
          removedCount++;
          console.log('[ShopRenter Structured Data] Removed existing enhanced structured data');
        }
      } catch (e) {
        // Ignore parse errors, but still check if it's our enhanced version
        if (script.hasAttribute('data-enhanced')) {
          script.remove();
          removedCount++;
          console.log('[ShopRenter Structured Data] Removed existing enhanced structured data (parse error)');
        }
      }
    });
    
    if (removedCount > 0) {
      console.log('[ShopRenter Structured Data] Removed', removedCount, 'existing structured data script(s)');
    }
  }

  function isValidSupplementalPayload(jsonLd) {
    if (!jsonLd || typeof jsonLd !== 'object') return false;
    if (Array.isArray(jsonLd['@graph'])) return jsonLd['@graph'].length > 0;
    if (Array.isArray(jsonLd)) return jsonLd.length > 0;
    return typeof jsonLd['@type'] === 'string' && jsonLd['@type'].length > 0;
  }

  /**
   * Check if our enhanced structured data already exists
   * Checks for both data-enhanced attribute and FAQPage schemas (which we inject)
   */
  function hasOurEnhancedStructuredData() {
    // Check for scripts with data-enhanced attribute
    const enhancedScripts = document.querySelectorAll('script[type="application/ld+json"][data-enhanced="true"]');
    if (enhancedScripts.length > 0) {
      // Also verify they contain valid structured data
      for (let script of enhancedScripts) {
        try {
          const content = script.textContent || '';
          if (content.trim()) {
            const data = JSON.parse(content);
            // Check if it's an array with FAQPage or a single FAQPage
            if (Array.isArray(data)) {
              const hasFAQPage = data.some(item => item && item['@type'] === 'FAQPage');
              if (hasFAQPage) {
                return true; // FAQPage found in array
              }
            } else if (data && data['@type'] === 'FAQPage') {
              return true; // Single FAQPage found
            }
          }
        } catch (e) {
          // If parse fails, check string content
          const content = script.textContent || '';
          if (content.includes('"@type":"FAQPage"') || content.includes('FAQPage')) {
            return true;
          }
        }
      }
    }
    
    // Also check for FAQPage schemas in ANY script (which we inject)
    const allScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of allScripts) {
      try {
        const content = script.textContent || '';
        if (!content.trim()) continue;
        
        const data = JSON.parse(content);
        // Check if it's an array with FAQPage or a single FAQPage
        if (Array.isArray(data)) {
          const hasFAQPage = data.some(item => item && item['@type'] === 'FAQPage');
          if (hasFAQPage) {
            return true; // FAQPage found in array
          }
        } else if (data && data['@type'] === 'FAQPage') {
          return true; // Single FAQPage found
        }
      } catch (e) {
        // If parse fails, check string content for FAQPage
        const content = script.textContent || '';
        if (content.includes('"@type":"FAQPage"') || content.includes('FAQPage')) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Inject JSON-LD structured data into page
   * Handles both single schema objects and arrays of schemas (e.g., [Product, FAQPage])
   */
  function injectStructuredData(jsonLd) {
    // Remove only previous enhanced injections from this script.
    removeExistingProductStructuredData();

    // Handle both single schema and array of schemas
    // If it's an array, we can inject multiple script tags OR use a single script with array
    // Using single script with array is more efficient and valid JSON-LD
    const schemasToInject = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    
    // Create script tag(s) for each schema
    schemasToInject.forEach((schema, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-enhanced', 'true');
      if (index === 0) {
        // First schema gets the main ID for compatibility
        script.id = 'enhanced-structured-data';
      }
      script.textContent = JSON.stringify(schema);

      // Insert into head (preferred location for structured data)
      const head = document.head || document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(script);
      } else {
        // Fallback to body if head not available
        document.body.appendChild(script);
      }
    });
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

  // Flag to prevent multiple simultaneous executions
  let isInitializing = false;
  let hasInitialized = false;

  /**
   * Main execution
   */
  function init() {
    // Prevent multiple simultaneous executions
    if (isInitializing) {
      return;
    }
    
    // If we've already successfully initialized, skip
    if (hasInitialized) {
      return;
    }

    // If product.tpl contains the dedicated enhanced placeholder, let product.tpl own injection.
    // This avoids duplicate fetches and race conditions.
    const productTplScript = document.getElementById('enhanced-structured-data');
    if (productTplScript) {
      console.log('[ShopRenter Structured Data] Product.tpl enhanced schema placeholder found, skipping Script Tag API');
      hasInitialized = true;
      return;
    }

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

    // Check if we already have our enhanced structured data (skip if already injected)
    if (hasOurEnhancedStructuredData()) {
      console.log('[ShopRenter Structured Data] Enhanced structured data already exists, skipping');
      hasInitialized = true;
      return;
    }

    // Get product identifier
    const productIdentifier = getProductIdentifier();
    if (!productIdentifier) {
      console.warn('[ShopRenter Structured Data] No product identifier found');
      return;
    }

    // Set flag to prevent concurrent executions
    isInitializing = true;
    console.log('[ShopRenter Structured Data] Fetching structured data for product:', productIdentifier);

    // Fetch and inject structured data
    fetchStructuredData(productIdentifier)
      .then(jsonLd => {
        // Double-check before injecting (another script might have injected while we were fetching)
        if (hasOurEnhancedStructuredData()) {
          console.log('[ShopRenter Structured Data] Enhanced structured data was injected by another script while fetching, skipping injection');
          hasInitialized = true;
          isInitializing = false;
          return;
        }
        
        if (jsonLd && isValidSupplementalPayload(jsonLd)) {
          console.log('[ShopRenter Structured Data] Successfully fetched structured data, injecting...');
          injectStructuredData(jsonLd);
          console.log('[ShopRenter Structured Data] Enhanced structured data injected successfully');
          hasInitialized = true;
        } else {
          console.warn('[ShopRenter Structured Data] No supplemental structured data returned from API');
        }
        isInitializing = false;
      })
      .catch(error => {
        console.error('[ShopRenter Structured Data] Error:', error);
        isInitializing = false;
      });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Also try after delays in case ShopRenter loads later
  // Try multiple times to catch ShopRenter's schema after it loads
  setTimeout(init, 500);
  setTimeout(init, 1000);
  setTimeout(init, 2000);
})();

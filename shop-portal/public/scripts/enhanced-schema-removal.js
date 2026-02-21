/**
 * Enhanced Schema Removal Script
 * 
 * This script aggressively removes ShopRenter's default Product/ProductGroup schemas
 * and ensures only our enhanced schema remains. It runs immediately and continuously monitors.
 * 
 * This should be included in header.tpl BEFORE any other scripts.
 */

(function() {
    'use strict';
    
    const API_URL = 'https://shop.turinova.hu';
    let schemaReplaced = false;
    let removalObserver = null;
    let injectionObserver = null;
    
    /**
     * Check if a script contains Product or ProductGroup schema
     */
    function isProductSchema(script) {
        // Skip our enhanced schema
        if (script.id === 'enhanced-structured-data' || script.hasAttribute('data-enhanced')) {
            return false;
        }
        
        try {
            const content = script.textContent || script.innerHTML || '';
            if (!content.trim()) {
                return false;
            }
            
            const data = JSON.parse(content);
            return data['@type'] === 'Product' || data['@type'] === 'ProductGroup';
        } catch(e) {
            // If it's not valid JSON, check if it looks like a product schema
            const content = (script.textContent || script.innerHTML || '').toLowerCase();
            return content.includes('"@type":"product') || content.includes('"@type":"productgroup');
        }
    }
    
    /**
     * Aggressively remove ALL Product/ProductGroup schemas except ours
     */
    function removeShopRenterSchemas() {
        // Check both head and body
        const containers = [document.head, document.body].filter(Boolean);
        let removedCount = 0;
        
        containers.forEach(container => {
            if (!container) return;
            
            // Use querySelectorAll to find all JSON-LD scripts
            const scripts = container.querySelectorAll('script[type="application/ld+json"]');
            
            for (let i = 0; i < scripts.length; i++) {
                const script = scripts[i];
                
                // Skip our enhanced schema
                if (script.id === 'enhanced-structured-data' || script.hasAttribute('data-enhanced')) {
                    continue;
                }
                
                // Check if it's a Product/ProductGroup schema
                if (isProductSchema(script)) {
                    script.remove();
                    removedCount++;
                    console.log('[Enhanced Schema] Removed ShopRenter schema');
                }
            }
        });
        
        return removedCount;
    }
    
    /**
     * Set up continuous monitoring to prevent ShopRenter schemas from being added
     */
    function setupContinuousMonitoring() {
        // Stop existing observers
        if (removalObserver) {
            removalObserver.disconnect();
        }
        if (injectionObserver) {
            injectionObserver.disconnect();
        }
        
        // Observer for removing schemas that get added
        removalObserver = new MutationObserver(function(mutations) {
            if (!schemaReplaced) {
                const removed = removeShopRenterSchemas();
                if (removed > 0) {
                    console.log('[Enhanced Schema] Removed', removed, 'ShopRenter schema(s) via MutationObserver');
                }
            }
        });
        
        // Observer specifically for script tag additions
        injectionObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
                        if (node.type === 'application/ld+json' && isProductSchema(node)) {
                            // Immediately remove if it's a Product schema
                            if (node.id !== 'enhanced-structured-data' && !node.hasAttribute('data-enhanced')) {
                                node.remove();
                                console.log('[Enhanced Schema] Prevented ShopRenter schema injection');
                            }
                        }
                    }
                });
            });
        });
        
        // Observe head and body for changes
        if (document.head) {
            removalObserver.observe(document.head, { 
                childList: true, 
                subtree: true,
                characterData: true
            });
            injectionObserver.observe(document.head, { 
                childList: true 
            });
        }
        
        if (document.body) {
            removalObserver.observe(document.body, { 
                childList: true, 
                subtree: true,
                characterData: true
            });
            injectionObserver.observe(document.body, { 
                childList: true 
            });
        }
    }
    
    /**
     * Main function to fetch and inject our enhanced schema
     */
    function replaceSchema() {
        if (schemaReplaced) {
            return;
        }
        
        // Always remove ShopRenter schemas first
        removeShopRenterSchemas();
        
        // Check if ShopRenter is available
        if (typeof ShopRenter === 'undefined' || !ShopRenter.product || !ShopRenter.product.sku) {
            // Retry after short delay
            setTimeout(replaceSchema, 100);
            return;
        }
        
        const sku = ShopRenter.product.sku;
        
        // Fetch enhanced structured data
        fetch(`${API_URL}/api/shoprenter/structured-data/${encodeURIComponent(sku)}.jsonld`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(jsonLd => {
                // Remove ShopRenter schemas again (in case they were added during fetch)
                removeShopRenterSchemas();
                
                // Get or create our schema script tag
                let script = document.getElementById('enhanced-structured-data');
                if (!script) {
                    script = document.createElement('script');
                    script.type = 'application/ld+json';
                    script.id = 'enhanced-structured-data';
                    script.setAttribute('data-enhanced', 'true');
                    
                    // Insert at the beginning of head for priority
                    const head = document.head || document.getElementsByTagName('head')[0];
                    if (head) {
                        head.insertBefore(script, head.firstChild);
                    } else if (document.body) {
                        document.body.insertBefore(script, document.body.firstChild);
                    }
                }
                
                // Inject our enhanced schema
                if (jsonLd) {
                    script.textContent = JSON.stringify(jsonLd);
                    schemaReplaced = true;
                    console.log('[Enhanced Schema] ✅ Injected enhanced structured data for SKU:', sku);
                    
                    // Final cleanup - remove any remaining ShopRenter schemas
                    setTimeout(removeShopRenterSchemas, 100);
                }
            })
            .catch(error => {
                console.error('[Enhanced Schema] ❌ Failed to load:', error);
            });
    }
    
    /**
     * Initialize - run immediately
     */
    function init() {
        // Remove any existing schemas immediately
        removeShopRenterSchemas();
        
        // Set up continuous monitoring
        if (typeof MutationObserver !== 'undefined') {
            setupContinuousMonitoring();
        }
        
        // Start trying to replace schema
        replaceSchema();
    }
    
    // Run IMMEDIATELY, even before DOM is ready
    if (document.readyState === 'loading') {
        // Run immediately
        init();
        
        // Also run when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            init();
            setupContinuousMonitoring();
        });
    } else {
        // DOM already ready
        init();
    }
    
    // Keep trying with delays to catch late-loading schemas
    setTimeout(init, 100);
    setTimeout(init, 500);
    setTimeout(init, 1000);
    setTimeout(init, 2000);
    setTimeout(init, 3000);
    
    // Also monitor window load event
    window.addEventListener('load', function() {
        removeShopRenterSchemas();
        replaceSchema();
    });
    
})();

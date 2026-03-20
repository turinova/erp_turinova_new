{% extends 'layout/1-column-no-container-layout.tpl' %}
{% set product_page_cart_box_sticky_enabled = config.get('config_product_cart_box_sticky') == '1' ? ' product-page-cart-box-sticky-enabled' : ''  %}

{% block content_declare %}
    {{ add_body_class("product-page-body js-product-page") }}
{% endblock %}

{% block page_head %}
    {# Enhanced Structured Data - MUST be in page_head to run BEFORE ShopRenter's schema #}
    {# This removes ShopRenter's default schema immediately and injects our enhanced one #}
    <script type="application/ld+json" id="enhanced-structured-data"></script>
    <script>
    (function() {
        'use strict';
        
        const API_URL = 'https://shop.turinova.hu';
        const TENANT_SLUG = 'tenant-1'; // Hardcoded tenant slug - change this if needed
        let schemaReplaced = false;
        
        // IMMEDIATELY remove any existing Product/ProductGroup schemas
        // This runs as soon as script loads, before DOM is ready
        function removeDefaultSchemasImmediately() {
            // Use querySelector on document (works even before DOM ready)
            const existingScripts = document.querySelectorAll ? document.querySelectorAll('script[type="application/ld+json"]') : [];
            let removed = 0;
            
            for (let i = 0; i < existingScripts.length; i++) {
                const script = existingScripts[i];
                if (script.id === 'enhanced-structured-data') {
                    continue;
                }
                
                try {
                    const data = JSON.parse(script.textContent || '{}');
                    if (data['@type'] === 'Product' || data['@type'] === 'ProductGroup') {
                        script.remove();
                        removed++;
                    }
                } catch(e) {
                    // Ignore parse errors
                }
            }
            
            return removed;
        }
        
        // Remove schemas immediately (before DOM ready)
        removeDefaultSchemasImmediately();
        
        // Also use MutationObserver to catch schemas added later
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function(mutations) {
                if (!schemaReplaced) {
                    const removed = removeDefaultSchemasImmediately();
                    if (removed > 0) {
                        console.log('[Enhanced Schema] Removed', removed, 'ShopRenter schema(s) via MutationObserver');
                    }
                }
            });
            
            // Start observing as soon as possible
            if (document.head) {
                observer.observe(document.head, { childList: true, subtree: true });
            }
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }
            
            // Also observe when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    if (document.head) observer.observe(document.head, { childList: true, subtree: true });
                    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
                });
            }
        }
        
        // Main function to fetch and inject schema
        function replaceSchema() {
            if (schemaReplaced) {
                return;
            }
            
            // Always remove default schemas first
            removeDefaultSchemasImmediately();
            
            // Check if ShopRenter is available
            if (typeof ShopRenter === 'undefined' || !ShopRenter.product || !ShopRenter.product.sku) {
                // Retry after short delay
                setTimeout(replaceSchema, 100);
                return;
            }
            
            const sku = ShopRenter.product.sku;
            
            // Build API URL with tenant parameter if available
            let apiUrl = `${API_URL}/api/shoprenter/structured-data/${encodeURIComponent(sku)}.jsonld`;
            if (TENANT_SLUG) {
                apiUrl += `?tenant=${encodeURIComponent(TENANT_SLUG)}`;
            }
            
            // Fetch enhanced structured data
            fetch(apiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(jsonLd => {
                    // Remove default schemas again (in case they were added after)
                    removeDefaultSchemasImmediately();
                    
                    // Inject our enhanced schema
                    const script = document.getElementById('enhanced-structured-data');
                    if (script && jsonLd) {
                        script.textContent = JSON.stringify(jsonLd);
                        schemaReplaced = true;
                        console.log('[Enhanced Schema] ✅ Injected enhanced structured data for SKU:', sku, TENANT_SLUG ? `(tenant: ${TENANT_SLUG})` : '');
                    }
                })
                .catch(error => {
                    console.error('[Enhanced Schema] ❌ Failed to load:', error);
                });
        }
        
        // Start immediately (even before DOM ready)
        replaceSchema();
        
        // Also try when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', replaceSchema);
        } else {
            replaceSchema();
        }
        
        // Keep trying with delays
        setTimeout(replaceSchema, 500);
        setTimeout(replaceSchema, 1000);
    })();
    </script>
{% endblock %}

{% block content %}
    {{ 'page-product.css' | asset_url | stylesheet_tag }}
    <div itemscope itemtype="//schema.org/Product">
        <section class="product-page-top container js-product-wrapper">
            <h1 class="page-head-title product-page-head-title position-relative">
                <span class="product-page-product-name" itemprop="name">{{ product_name }}</span>
                {% if isDeviceType('desktop') == true and show_edit_link %}
                    <a href="{{ '/admin/index.php?route=catalog/product/update&product_id=' ~ product_id }}"
                       target="_blank" title="{{ 'button_edit'|trans }}" class="edit-link">
                        {{ include('snippets/icon_edit.tpl') }}
                    </a>
                {% endif %}
            </h1>
            <div class="js-product-page-top-grid product-page-top-grid">
                <div class="product-page-top-grid__element-1">
                    <div class="product-page-image position-relative">
                        {% include "product/product_image.tpl" with {
                            'product_info': product_info,
                            'text_enlarge': text_enlarge
                        } only %}
                        {{ position_5 ? position_5 : '' }}
                    </div>
                </div>
                <div class="product-page-top-grid__element-2">
                    {{ position_1 }}
                </div>
                <div class="product-page-top-grid__element-3">
                    <form action="{{ action }}" method="post" enctype="multipart/form-data" id="product" class="product-page-top-form">
                        {% include 'product/product_sticky.tpl' %}
                        <div class="product-page-right product-page-right__element{{ product_page_cart_box_sticky_enabled }}">
                            <div class="product-page-right__element-inner">
                                {% if config.get('config_customer_price') and not customer.isLogged() and product_info.available != 3 %}
                                    {{ include('snippets/registration_required_for_prices_help_content.tpl') }}
                                {% else %}
                                    {% if display_price %}
                                        {{ pricehtml }}
                                    {% endif %}
                                {% endif%}

                                <div class="js-product-cart-box product-cart-box">
                                    {% if productattributes1r %}
                                        {{ productattributes1r }}
                                    {% endif %}

                                    {% if display_price %}
                                        {% if options %}
                                            {% include "product/product_options.tpl" %}
                                        {% endif %}
                                    {% endif %}

                                    {{ productaddtocart }}

                                    {% if productcollateral %}
                                        {{ productcollateral }}
                                    {% endif %}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="product-page-top-grid__element-4">
                    {{ childlist }}
                    {{ viewHelper.loadPosition('main-product-bottom') }}
                    {{ position_2 }}
                    {{ position_3 }}
                    {{ position_4 }}
                    {% if tags %}
                        <section class="product-page-tags">
                            <div class="product-page-container">
                                <div class="tags d-flex flex-wrap">
                                    <div class="tags__title">{{ text_tags|trans }}</div>
                                    {% for tag in tags %}
                                        <a href="{{ tag.href }}" class="tags__link">{{ tag.tag }}</a>
                                    {% endfor %}
                                </div>
                                {{ 'component-product-tags.css' | asset_url | stylesheet_tag }}
                            </div>
                        </section>
                    {% endif %}
                </div>
            </div>
        </section>
    </div>

    {% if show_google_tag %}
        <div class="google_tag">{% include 'common/google_tag_parameter.tpl' with parameter_bag %}</div>
    {% endif %}
{% endblock %}

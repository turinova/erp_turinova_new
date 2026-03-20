{% extends 'layout/1-column-no-container-layout.tpl' %}
{% set product_page_cart_box_sticky_enabled = config.get('config_product_cart_box_sticky') == '1' ? ' product-page-cart-box-sticky-enabled' : ''  %}

{% block content_declare %}
    {{ add_body_class("product-page-body js-product-page") }}
{% endblock %}

{% block page_head %}
    {# Enhanced Structured Data #}
    {# Keep ShopRenter native Product schema; inject enrichment only #}
    <script type="application/ld+json" id="enhanced-structured-data"></script>
    <script>
    (function() {
        'use strict';
        
        const API_URL = 'https://shop.turinova.hu';
        const TENANT_SLUG = 'tenant-1'; // Hardcoded tenant slug - change this if needed
        let schemaInjected = false;

        function deepMergeProductEnrichment(nativeNode, enrichmentNode) {
            if (!nativeNode || !enrichmentNode) return nativeNode;

            const merged = Object.assign({}, nativeNode);

            // Merge enrichment fields.
            const simpleFields = ['description', 'brand', 'manufacturer', 'additionalProperty'];
            simpleFields.forEach(function(field) {
                if (enrichmentNode[field] !== undefined && enrichmentNode[field] !== null) {
                    merged[field] = enrichmentNode[field];
                }
            });

            // Merge live commerce fields from enrichment endpoint.
            if (enrichmentNode.offers) {
                merged.offers = enrichmentNode.offers;
            }
            if (enrichmentNode.url) {
                merged.url = enrichmentNode.url;
            }

            // Merge variant-level commerce by SKU to keep one canonical Product/ProductGroup.
            if (Array.isArray(merged.hasVariant) && Array.isArray(enrichmentNode.hasVariant)) {
                const enrichmentBySku = {};
                for (let i = 0; i < enrichmentNode.hasVariant.length; i++) {
                    const variant = enrichmentNode.hasVariant[i];
                    if (variant && variant.sku) {
                        enrichmentBySku[variant.sku] = variant;
                    }
                }

                merged.hasVariant = merged.hasVariant.map(function(nativeVariant) {
                    if (!nativeVariant || !nativeVariant.sku) return nativeVariant;
                    const source = enrichmentBySku[nativeVariant.sku];
                    if (!source) return nativeVariant;
                    const mergedVariant = Object.assign({}, nativeVariant);

                    if (source.additionalProperty !== undefined && source.additionalProperty !== null) {
                        mergedVariant.additionalProperty = source.additionalProperty;
                    }
                    if (source.offers) {
                        mergedVariant.offers = source.offers;
                    }
                    if (source.url) {
                        mergedVariant.url = source.url;
                    }
                    if (source.name) {
                        mergedVariant.name = source.name;
                    }
                    return mergedVariant;
                });
            }

            return merged;
        }

        function extractPrimaryEntity(jsonLd) {
            if (!jsonLd) return null;
            if (Array.isArray(jsonLd['@graph']) && jsonLd['@graph'].length > 0) {
                return jsonLd['@graph'].find(item => item && (item['@type'] === 'Product' || item['@type'] === 'ProductGroup')) || null;
            }
            if (Array.isArray(jsonLd) && jsonLd.length > 0) {
                return jsonLd.find(item => item && (item['@type'] === 'Product' || item['@type'] === 'ProductGroup')) || null;
            }
            if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'ProductGroup') {
                return jsonLd;
            }
            return null;
        }

        function findNativeProductScript() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (let i = 0; i < scripts.length; i++) {
                const script = scripts[i];
                if (script.id === 'enhanced-structured-data' || script.hasAttribute('data-enhanced')) continue;
                try {
                    const data = JSON.parse(script.textContent || '{}');
                    const primary = extractPrimaryEntity(data);
                    if (primary) return { script, data, primary };
                } catch (e) {
                    // ignore parse errors
                }
            }
            return null;
        }

        function extractSupplementalEntities(jsonLd) {
            const entities = [];
            if (!jsonLd) return entities;

            let source = [];
            if (Array.isArray(jsonLd['@graph'])) {
                source = jsonLd['@graph'];
            } else if (Array.isArray(jsonLd)) {
                source = jsonLd;
            } else if (jsonLd && typeof jsonLd === 'object') {
                source = [jsonLd];
            }

            for (let i = 0; i < source.length; i++) {
                const entity = source[i];
                if (!entity || typeof entity !== 'object') continue;
                const type = entity['@type'];
                if (type === 'Product' || type === 'ProductGroup') continue;
                entities.push(entity);
            }

            return entities;
        }
        
        // Main function to fetch and inject schema
        function replaceSchema() {
            if (schemaInjected) {
                return;
            }
            
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
                    const enrichmentEntity = extractPrimaryEntity(jsonLd);
                    const nativeResult = findNativeProductScript();
                    const supplementalEntities = extractSupplementalEntities(jsonLd);

                    if (enrichmentEntity && nativeResult) {
                        const mergedPrimary = deepMergeProductEnrichment(nativeResult.primary, enrichmentEntity);

                        // Replace primary entity in-place while preserving native structure and offers.
                        if (Array.isArray(nativeResult.data['@graph'])) {
                            nativeResult.data['@graph'] = nativeResult.data['@graph'].map(item => {
                                if (item === nativeResult.primary) return mergedPrimary;
                                return item;
                            });
                        } else if (Array.isArray(nativeResult.data)) {
                            nativeResult.data = nativeResult.data.map(item => {
                                if (item === nativeResult.primary) return mergedPrimary;
                                return item;
                            });
                        } else {
                            nativeResult.data = mergedPrimary;
                        }

                        nativeResult.script.textContent = JSON.stringify(nativeResult.data);
                        schemaInjected = true;
                        console.log('[Enhanced Schema] ✅ Merged enrichment into native schema for SKU:', sku, TENANT_SLUG ? `(tenant: ${TENANT_SLUG})` : '');
                    } else {
                        // Never inject Product/ProductGroup as fallback to avoid duplicate Product entities.
                        if (enrichmentEntity && !nativeResult) {
                            console.warn('[Enhanced Schema] Native Product schema not found yet; skipping Product fallback injection to prevent duplicates.');
                        }

                        // FAQ / supplemental-only fallback path
                        const script = document.getElementById('enhanced-structured-data');
                        if (script && supplementalEntities.length > 0) {
                            const payload = supplementalEntities.length === 1 ? supplementalEntities[0] : {
                                '@context': 'https://schema.org/',
                                '@graph': supplementalEntities
                            };
                            script.textContent = JSON.stringify(payload);
                            schemaInjected = true;
                            console.log('[Enhanced Schema] ✅ Injected supplemental schema for SKU:', sku, TENANT_SLUG ? `(tenant: ${TENANT_SLUG})` : '');
                        } else {
                            console.log('[Enhanced Schema] No supplemental schema returned for SKU:', sku);
                        }
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

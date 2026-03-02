-- =============================================================================
-- BASELINE MIGRATION - Generated from Manual Extraction
-- =============================================================================
-- WARNING: This only includes table structures
-- Missing: indexes, foreign keys, functions, RLS policies, triggers, extensions
-- 
-- RECOMMENDATION: Use tenant-database-template.sql instead which has everything!
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.category_description_generations (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  category_id UUID NOT NULL, 
  generated_description TEXT NOT NULL, 
  model TEXT DEFAULT 'claude-3-5-sonnet-20241022'::text, 
  tokens_used INTEGER, 
  source_products_count INTEGER, 
  generation_instructions TEXT, 
  language TEXT DEFAULT 'hu'::text, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.competitor_prices (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  competitor_product_link_id UUID NOT NULL, 
  price NUMERIC(15,2), 
  original_price NUMERIC(15,2), 
  currency TEXT DEFAULT 'HUF'::text, 
  in_stock BOOLEAN, 
  extracted_product_name TEXT, 
  extracted_data JSONB, 
  raw_html_hash TEXT, 
  scrape_duration_ms INTEGER, 
  ai_model_used TEXT, 
  scraped_at TIMESTAMPTZ DEFAULT now(), 
  price_gross NUMERIC(15,2), 
  price_type TEXT DEFAULT 'gross'::text, 
  vat_rate NUMERIC(5,2) DEFAULT 27.00
);

CREATE TABLE IF NOT EXISTS public.competitor_product_links (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  competitor_id UUID NOT NULL, 
  competitor_url TEXT NOT NULL, 
  competitor_sku TEXT, 
  competitor_product_name TEXT, 
  matching_method TEXT DEFAULT 'manual'::text, 
  matching_confidence NUMERIC(5,2), 
  is_active BOOLEAN DEFAULT true, 
  last_checked_at TIMESTAMPTZ, 
  last_error TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  name TEXT NOT NULL, 
  website_url TEXT NOT NULL, 
  scrape_config JSONB DEFAULT '{}'::jsonb, 
  is_active BOOLEAN DEFAULT true, 
  last_scraped_at TIMESTAMPTZ, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pages (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  path VARCHAR(255) NOT NULL, 
  name VARCHAR(255) NOT NULL, 
  category VARCHAR(255), 
  created_at TIMESTAMP DEFAULT now(), 
  is_active BOOLEAN DEFAULT true, 
  description TEXT, 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_content_chunks (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  source_material_id UUID NOT NULL, 
  product_id UUID NOT NULL, 
  chunk_text TEXT NOT NULL, 
  chunk_type TEXT, 
  embedding USER-DEFINED, 
  page_number INTEGER, 
  section_title TEXT, 
  order_index INTEGER, 
  relevance_score NUMERIC(3,2) DEFAULT 1.0, 
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_description_generations (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  description_id UUID, 
  model_used TEXT NOT NULL, 
  prompt_version TEXT, 
  source_materials_used ARRAY, 
  generated_description TEXT NOT NULL, 
  ai_detection_score NUMERIC(3,2), 
  uniqueness_score NUMERIC(3,2), 
  word_count INTEGER, 
  status TEXT DEFAULT 'draft'::text, 
  reviewed_by UUID, 
  reviewed_at TIMESTAMPTZ, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  shoprenter_image_id TEXT, 
  image_path TEXT NOT NULL, 
  image_url TEXT, 
  sort_order INTEGER DEFAULT 0, 
  is_main_image BOOLEAN DEFAULT false, 
  alt_text TEXT, 
  alt_text_status TEXT DEFAULT 'pending'::text, 
  alt_text_generated_at TIMESTAMPTZ, 
  alt_text_synced_at TIMESTAMPTZ, 
  last_synced_at TIMESTAMPTZ, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_indexing_status (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  is_indexed BOOLEAN DEFAULT false, 
  last_crawled TIMESTAMPTZ, 
  coverage_state TEXT, 
  indexing_state TEXT, 
  has_issues BOOLEAN DEFAULT false, 
  issues JSONB, 
  last_checked TIMESTAMPTZ DEFAULT now(), 
  check_count INTEGER DEFAULT 0, 
  page_fetch_state TEXT, 
  page_fetch_error TEXT, 
  mobile_usability_issues JSONB, 
  mobile_usability_passed BOOLEAN DEFAULT false, 
  core_web_vitals JSONB, 
  structured_data_issues JSONB, 
  rich_results_eligible ARRAY, 
  sitemap_status TEXT, 
  sitemap_url TEXT
);

CREATE TABLE IF NOT EXISTS public.product_quality_scores (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  is_parent BOOLEAN DEFAULT false NOT NULL, 
  overall_score INTEGER DEFAULT 0 NOT NULL, 
  content_score INTEGER DEFAULT 0, 
  image_score INTEGER DEFAULT 0, 
  technical_score INTEGER DEFAULT 0, 
  performance_score INTEGER DEFAULT 0, 
  completeness_score INTEGER DEFAULT 0, 
  competitive_score INTEGER DEFAULT 0, 
  priority_score NUMERIC(10,2) DEFAULT 0, 
  issues JSONB DEFAULT '[]'::jsonb, 
  blocking_issues ARRAY, 
  last_calculated_at TIMESTAMPTZ DEFAULT now(), 
  calculation_version TEXT DEFAULT '1.0'::text
);

CREATE TABLE IF NOT EXISTS public.product_search_performance (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  date DATE NOT NULL, 
  impressions INTEGER DEFAULT 0, 
  clicks INTEGER DEFAULT 0, 
  ctr NUMERIC(5,4) DEFAULT 0, 
  position NUMERIC(5,2) DEFAULT 0, 
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_search_queries (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  query TEXT NOT NULL, 
  date DATE NOT NULL, 
  impressions INTEGER DEFAULT 0, 
  clicks INTEGER DEFAULT 0, 
  ctr NUMERIC(5,4) DEFAULT 0, 
  position NUMERIC(5,2) DEFAULT 0, 
  intent TEXT, 
  first_seen TIMESTAMPTZ DEFAULT now(), 
  last_seen TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_source_materials (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  source_type TEXT NOT NULL, 
  title TEXT, 
  file_url TEXT, 
  external_url TEXT, 
  text_content TEXT, 
  file_name TEXT, 
  processing_status TEXT DEFAULT 'pending'::text, 
  extracted_text TEXT, 
  processing_error TEXT, 
  file_size INTEGER, 
  mime_type TEXT, 
  language_code TEXT DEFAULT 'hu'::text, 
  priority INTEGER DEFAULT 5, 
  weight NUMERIC(3,2) DEFAULT 1.0, 
  uploaded_by UUID, 
  uploaded_at TIMESTAMPTZ DEFAULT now(), 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.product_tags (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  connection_id UUID NOT NULL, 
  language_code VARCHAR(10) NOT NULL, 
  tags TEXT NOT NULL, 
  shoprenter_id TEXT, 
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL, 
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, 
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.shoprenter_categories (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  connection_id UUID NOT NULL, 
  shoprenter_id TEXT NOT NULL, 
  shoprenter_inner_id TEXT, 
  name TEXT, 
  picture TEXT, 
  sort_order INTEGER DEFAULT 0, 
  status INTEGER DEFAULT 1, 
  products_status INTEGER DEFAULT 1, 
  parent_category_id UUID, 
  parent_category_shoprenter_id TEXT, 
  url_slug TEXT, 
  url_alias_id TEXT, 
  category_url TEXT, 
  sync_status TEXT DEFAULT 'pending'::text, 
  sync_error TEXT, 
  last_synced_at TIMESTAMPTZ, 
  date_created TIMESTAMPTZ, 
  date_updated TIMESTAMPTZ, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.shoprenter_category_descriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  category_id UUID NOT NULL, 
  shoprenter_id TEXT NOT NULL, 
  language_id TEXT NOT NULL, 
  name TEXT, 
  meta_keywords TEXT, 
  meta_description TEXT, 
  description TEXT, 
  custom_title TEXT, 
  robots_meta_tag TEXT DEFAULT '0'::text, 
  footer_seo_text TEXT, 
  heading TEXT, 
  short_description TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shoprenter_product_category_relations (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  connection_id UUID NOT NULL, 
  shoprenter_id TEXT NOT NULL, 
  product_id UUID NOT NULL, 
  category_id UUID NOT NULL, 
  product_shoprenter_id TEXT NOT NULL, 
  category_shoprenter_id TEXT NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.shoprenter_product_descriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  product_id UUID NOT NULL, 
  language_code TEXT DEFAULT 'hu'::text NOT NULL, 
  name TEXT NOT NULL, 
  meta_title TEXT, 
  meta_keywords TEXT, 
  meta_description TEXT, 
  short_description TEXT, 
  description TEXT, 
  shoprenter_id TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  generation_instructions TEXT, 
  parameters TEXT
);

CREATE TABLE IF NOT EXISTS public.shoprenter_products (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  connection_id UUID NOT NULL, 
  shoprenter_id TEXT NOT NULL, 
  shoprenter_inner_id TEXT, 
  sku TEXT NOT NULL, 
  name TEXT, 
  status INTEGER DEFAULT 1, 
  last_synced_at TIMESTAMPTZ, 
  sync_status TEXT DEFAULT 'pending'::text, 
  sync_error TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  deleted_at TIMESTAMPTZ, 
  product_url TEXT, 
  url_slug TEXT, 
  last_url_synced_at TIMESTAMPTZ, 
  model_number TEXT, 
  price NUMERIC(15,4), 
  cost NUMERIC(15,4), 
  multiplier NUMERIC(10,4) DEFAULT 1.0000, 
  multiplier_lock BOOLEAN DEFAULT false, 
  gtin TEXT, 
  competitor_tracking_enabled BOOLEAN DEFAULT false, 
  url_alias_id TEXT, 
  parent_product_id TEXT, 
  product_attributes JSONB, 
  brand TEXT, 
  vat_id UUID, 
  gross_price NUMERIC(15,4), 
  shoprenter_tax_class_id TEXT
);

CREATE TABLE IF NOT EXISTS public.shoprenter_tax_class_mappings (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  connection_id UUID NOT NULL, 
  vat_id UUID NOT NULL, 
  shoprenter_tax_class_id TEXT NOT NULL, 
  shoprenter_tax_class_name TEXT, 
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL, 
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  name VARCHAR(255) NOT NULL, 
  slug VARCHAR(100) NOT NULL, 
  price_monthly NUMERIC(10,2), 
  price_yearly NUMERIC(10,2), 
  features JSONB DEFAULT '{}'::jsonb, 
  is_active BOOLEAN DEFAULT true, 
  display_order INTEGER DEFAULT 0, 
  created_at TIMESTAMP DEFAULT now(), 
  updated_at TIMESTAMP DEFAULT now(), 
  ai_credits_per_month INTEGER DEFAULT 0, 
  competitor_limits JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  user_id UUID NOT NULL, 
  page_id UUID NOT NULL, 
  can_access BOOLEAN DEFAULT false, 
  created_at TIMESTAMP DEFAULT now(), 
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  user_id UUID NOT NULL, 
  plan_id UUID NOT NULL, 
  status VARCHAR(50) DEFAULT 'trial'::character varying NOT NULL, 
  stripe_subscription_id VARCHAR(255), 
  stripe_customer_id VARCHAR(255), 
  current_period_start TIMESTAMP, 
  current_period_end TIMESTAMP, 
  trial_end TIMESTAMP, 
  canceled_at TIMESTAMP, 
  created_at TIMESTAMP DEFAULT now(), 
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL, 
  email TEXT NOT NULL, 
  full_name TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  last_sign_in_at TIMESTAMPTZ, 
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.vat (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  name VARCHAR(255) NOT NULL, 
  kulcs NUMERIC(5,2) NOT NULL, 
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL, 
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, 
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.webshop_connections (
  id UUID DEFAULT gen_random_uuid() NOT NULL, 
  name VARCHAR(255) NOT NULL, 
  connection_type VARCHAR(50) DEFAULT 'shoprenter'::character varying NOT NULL, 
  api_url TEXT NOT NULL, 
  username VARCHAR(255) NOT NULL, 
  password TEXT NOT NULL, 
  is_active BOOLEAN DEFAULT true, 
  last_tested_at TIMESTAMPTZ, 
  last_test_status VARCHAR(50), 
  last_test_error TEXT, 
  created_at TIMESTAMPTZ DEFAULT now(), 
  updated_at TIMESTAMPTZ DEFAULT now(), 
  deleted_at TIMESTAMPTZ, 
  search_console_property_url TEXT, 
  search_console_client_email TEXT, 
  search_console_private_key TEXT, 
  search_console_enabled BOOLEAN DEFAULT false, 
  merchant_center_account_id TEXT, 
  merchant_center_client_email TEXT, 
  merchant_center_private_key TEXT, 
  merchant_center_enabled BOOLEAN DEFAULT false
);

-- =============================================================================
-- WARNING: This file is INCOMPLETE!
-- =============================================================================
-- It only contains table structures. Missing:
--   - Primary keys (need to add PRIMARY KEY constraints)
--   - Foreign keys
--   - Indexes
--   - Functions
--   - RLS policies
--   - Triggers
--   - Extensions (pg_trgm, vector, etc.)
--   - Sequences
--   - Unique constraints
--   - Check constraints
--
-- RECOMMENDATION: Use tenant-database-template.sql instead!
-- It has all migrations with all fixes applied.
-- =============================================================================

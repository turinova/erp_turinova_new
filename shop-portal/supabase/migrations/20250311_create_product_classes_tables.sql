-- Product Classes Sync - Database Schema
-- Creates tables for ShopRenter Product Classes and their attribute relations
-- Similar to categories sync pattern

-- Product Classes table
CREATE TABLE IF NOT EXISTS public.shoprenter_product_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded Product Class ID from ShopRenter
  shoprenter_inner_id TEXT, -- Inner ID (numeric)
  
  -- Product Class data
  name TEXT NOT NULL,
  description TEXT,
  
  -- Variant configuration (for product variants)
  first_variant_select_type TEXT, -- SELECT, RADIO, etc.
  second_variant_select_type TEXT,
  first_variant_parameter_shoprenter_id TEXT, -- Attribute ID for first variant
  second_variant_parameter_shoprenter_id TEXT, -- Attribute ID for second variant
  
  -- Sync tracking
  sync_status TEXT DEFAULT 'pending', -- pending, synced, error
  sync_error TEXT,
  last_synced_from_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced FROM ShopRenter (pulled into ERP)
  last_synced_to_shoprenter_at TIMESTAMP WITH TIME ZONE, -- When last synced TO ShopRenter (pushed from ERP)
  date_created TIMESTAMP WITH TIME ZONE,
  date_updated TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id)
);

-- Indexes for Product Classes
CREATE INDEX IF NOT EXISTS idx_product_classes_connection 
  ON public.shoprenter_product_classes(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_classes_shoprenter_id 
  ON public.shoprenter_product_classes(shoprenter_id);
CREATE INDEX IF NOT EXISTS idx_product_classes_name 
  ON public.shoprenter_product_classes(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_classes_sync_status 
  ON public.shoprenter_product_classes(sync_status) WHERE deleted_at IS NULL;

-- Product Class - Attribute Relations table
-- Stores which attributes belong to which Product Class
CREATE TABLE IF NOT EXISTS public.shoprenter_product_class_attribute_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.webshop_connections(id) ON DELETE CASCADE,
  
  -- ShopRenter identifiers
  shoprenter_id TEXT NOT NULL, -- Base64 encoded relation ID from ShopRenter
  
  -- Relations
  product_class_id UUID NOT NULL REFERENCES public.shoprenter_product_classes(id) ON DELETE CASCADE,
  attribute_shoprenter_id TEXT NOT NULL, -- ShopRenter attribute ID
  attribute_type TEXT NOT NULL, -- LIST, INTEGER, FLOAT, TEXT
  attribute_name TEXT, -- Internal name (e.g., "meret", "szin")
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(connection_id, shoprenter_id),
  UNIQUE(product_class_id, attribute_shoprenter_id)
);

-- Indexes for Product Class - Attribute Relations
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_class 
  ON public.shoprenter_product_class_attribute_relations(product_class_id);
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_connection 
  ON public.shoprenter_product_class_attribute_relations(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_class_attr_relations_attribute 
  ON public.shoprenter_product_class_attribute_relations(attribute_shoprenter_id);

-- Comments
COMMENT ON TABLE public.shoprenter_product_classes IS 
'ShopRenter Product Classes (Product Types) synced from ShopRenter API. Product Classes define which attributes are available for products.';

COMMENT ON TABLE public.shoprenter_product_class_attribute_relations IS 
'Relations between Product Classes and Attributes. Defines which attributes belong to which Product Class.';

COMMENT ON COLUMN public.shoprenter_product_classes.shoprenter_id IS 
'Base64 encoded Product Class ID from ShopRenter API (e.g., cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MTQ=)';

COMMENT ON COLUMN public.shoprenter_product_classes.name IS 
'Product Class name (e.g., "Fiók", "Csavar", "Szobanövény")';

COMMENT ON COLUMN public.shoprenter_product_classes.first_variant_parameter_shoprenter_id IS 
'ShopRenter attribute ID used for first variant parameter (for product variants)';

COMMENT ON COLUMN public.shoprenter_product_class_attribute_relations.attribute_shoprenter_id IS 
'ShopRenter attribute ID (base64 encoded)';

COMMENT ON COLUMN public.shoprenter_product_class_attribute_relations.attribute_type IS 
'Attribute type: LIST, INTEGER, FLOAT, or TEXT';

-- Enable RLS
ALTER TABLE public.shoprenter_product_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoprenter_product_class_attribute_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view Product Classes
CREATE POLICY "Product Classes are viewable by authenticated users" 
  ON public.shoprenter_product_classes
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- RLS Policies: All authenticated users can view Product Class - Attribute Relations
CREATE POLICY "Product Class Attribute Relations are viewable by authenticated users" 
  ON public.shoprenter_product_class_attribute_relations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- RLS Policies: Only authorized users can manage Product Classes (same as products/categories)
CREATE POLICY "Only authorized users can manage Product Classes" 
  ON public.shoprenter_product_classes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- RLS Policies: Only authorized users can manage Product Class - Attribute Relations
CREATE POLICY "Only authorized users can manage Product Class Attribute Relations" 
  ON public.shoprenter_product_class_attribute_relations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions up
      JOIN public.pages p ON up.page_id = p.id
      WHERE up.user_id = auth.uid() 
      AND p.path = '/products' 
      AND up.can_access = true
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shoprenter_product_class_attribute_relations TO authenticated;

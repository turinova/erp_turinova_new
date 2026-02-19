-- Add generation_instructions field to shoprenter_product_descriptions
-- This allows users to provide custom instructions for AI description generation
-- Run this SQL manually in your Supabase SQL Editor

ALTER TABLE public.shoprenter_product_descriptions
ADD COLUMN IF NOT EXISTS generation_instructions TEXT;

COMMENT ON COLUMN public.shoprenter_product_descriptions.generation_instructions IS 
'Custom instructions for AI description generation. Example: "A forrásanyagok 450mm fiókra vonatkoznak, de a leírás 300-550mm közötti méreteket fedjen le"';

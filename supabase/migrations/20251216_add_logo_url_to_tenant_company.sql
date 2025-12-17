-- Add logo_url column to tenant_company table
ALTER TABLE public.tenant_company
ADD COLUMN IF NOT EXISTS logo_url text NULL;


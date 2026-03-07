-- Create customer_groups table for pricing system
-- This table stores customer groups (vevőcsoportok) used for different pricing tiers
-- Maps to ShopRenter customer groups

CREATE TABLE IF NOT EXISTS public.customer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- ShopRenter sync
    shoprenter_customer_group_id TEXT,
    
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Add unique constraint on code (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_groups_code_unique_active 
ON public.customer_groups (code) 
WHERE deleted_at IS NULL;

-- Add unique constraint on name (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS customer_groups_name_unique_active 
ON public.customer_groups (name) 
WHERE deleted_at IS NULL;

-- Add index for better performance when filtering out deleted records
CREATE INDEX IF NOT EXISTS ix_customer_groups_deleted_at ON public.customer_groups(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_customer_groups_active ON public.customer_groups(is_active) WHERE deleted_at IS NULL;

-- Create trigger for customer_groups table to automatically update updated_at
DROP TRIGGER IF EXISTS update_customer_groups_updated_at ON public.customer_groups;
CREATE TRIGGER update_customer_groups_updated_at
    BEFORE UPDATE ON public.customer_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for customer_groups table
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_groups table
DROP POLICY IF EXISTS "Customer groups are viewable by authenticated users" ON public.customer_groups;
CREATE POLICY "Customer groups are viewable by authenticated users" 
ON public.customer_groups
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Customer groups are manageable by authenticated users" ON public.customer_groups;
CREATE POLICY "Customer groups are manageable by authenticated users" 
ON public.customer_groups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_groups TO authenticated;

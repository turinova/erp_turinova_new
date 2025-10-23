-- Create payment_methods table for storing payment method options
-- This table stores available payment methods for quotes and orders

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(50) NOT NULL,
  comment text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_name_key UNIQUE (name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_active 
ON public.payment_methods USING btree (active) 
TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_name 
ON public.payment_methods USING btree (name) 
TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at 
ON public.payment_methods USING btree (deleted_at) 
TABLESPACE pg_default;

-- Add auto-update trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add column comments for documentation
COMMENT ON TABLE public.payment_methods IS 'Available payment methods for quotes and orders';
COMMENT ON COLUMN public.payment_methods.name IS 'Payment method name (e.g., Készpénz, Bankkártya) - max 50 characters';
COMMENT ON COLUMN public.payment_methods.comment IS 'Optional description or notes about the payment method';
COMMENT ON COLUMN public.payment_methods.active IS 'Whether this payment method is currently active/available';
COMMENT ON COLUMN public.payment_methods.deleted_at IS 'Soft delete timestamp - NULL means not deleted';

-- Insert default payment methods
INSERT INTO public.payment_methods (name, comment, active) VALUES
  ('Készpénz', 'Készpénzes fizetés átvételkor', true),
  ('Bankkártya', 'Bankkártyás fizetés POS terminálon', true),
  ('Átutalás', 'Banki átutalás előre vagy utólag', true),
  ('Díjbekérő', 'Proforma számla alapján', true),
  ('Utánvét', 'Utánvétes fizetés szállításkor', true),
  ('Online fizetés', 'Online bankkártyás fizetés', true);

-- Add page to pages table for permission system
INSERT INTO public.pages (path, name, description, category, is_active) VALUES (
  '/payment-methods',
  'Fizetési módok',
  'Fizetési módok kezelése és szerkesztése',
  'Törzsadatok',
  true
) ON CONFLICT (path) DO NOTHING;

-- Grant all users permission to access payment methods page
-- This ensures all existing and new users can access the page
DO $$
DECLARE
  user_record RECORD;
  page_id_var uuid;
BEGIN
  -- Get the page ID
  SELECT id INTO page_id_var FROM pages WHERE path = '/payment-methods';
  
  -- Grant permission to all existing users
  FOR user_record IN SELECT id FROM auth.users WHERE deleted_at IS NULL
  LOOP
    INSERT INTO user_permissions (user_id, page_id, can_access)
    VALUES (user_record.id, page_id_var, true)
    ON CONFLICT (user_id, page_id) DO UPDATE SET can_access = true;
  END LOOP;
END $$;


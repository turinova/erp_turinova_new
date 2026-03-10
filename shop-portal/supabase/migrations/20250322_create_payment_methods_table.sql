-- Create payment_methods table for storing payment method options
-- This table stores available payment methods for suppliers and orders

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  comment TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_name_key UNIQUE (name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_active 
ON public.payment_methods (active) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_name 
ON public.payment_methods (name) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at 
ON public.payment_methods (deleted_at);

-- Create trigger for payment_methods table to automatically update updated_at
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for payment_methods table
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods table
DROP POLICY IF EXISTS "Payment methods are viewable by authenticated users" ON public.payment_methods;
CREATE POLICY "Payment methods are viewable by authenticated users" 
ON public.payment_methods
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Payment methods are manageable by authenticated users" ON public.payment_methods;
CREATE POLICY "Payment methods are manageable by authenticated users" 
ON public.payment_methods
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;

-- Insert default payment methods
INSERT INTO public.payment_methods (name, comment, active) VALUES
  ('Készpénz', 'Készpénzes fizetés átvételkor', true),
  ('Bankkártya', 'Bankkártyás fizetés POS terminálon', true),
  ('Átutalás', 'Banki átutalás előre vagy utólag', true),
  ('Díjbekérő', 'Proforma számla alapján', true),
  ('Utánvét', 'Utánvétes fizetés szállításkor', true),
  ('Online fizetés', 'Online bankkártyás fizetés', true)
ON CONFLICT ON CONSTRAINT payment_methods_name_key DO NOTHING;

-- Add foreign key constraint to suppliers table
ALTER TABLE public.suppliers 
ADD CONSTRAINT suppliers_default_payment_method_id_fkey 
FOREIGN KEY (default_payment_method_id) 
REFERENCES public.payment_methods(id) 
ON DELETE SET NULL;

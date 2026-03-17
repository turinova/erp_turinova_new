-- Add company customer support to orders
-- Order can link to either customer_person_id OR customer_company_id (or neither for guest)

-- Add customer_company_id and customer_company_name
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_company_id UUID REFERENCES public.customer_companies(id),
  ADD COLUMN IF NOT EXISTS customer_company_name TEXT;

-- Make customer firstname/lastname nullable (when customer is company we use customer_company_name)
ALTER TABLE public.orders
  ALTER COLUMN customer_firstname DROP NOT NULL,
  ALTER COLUMN customer_lastname DROP NOT NULL;

-- Ensure at most one of person/company is set (application-level or trigger; optional check)
-- CONSTRAINT: (customer_person_id IS NULL OR customer_company_id IS NULL) or both null for guest
CREATE INDEX IF NOT EXISTS idx_orders_customer_company_id
  ON public.orders(customer_company_id) WHERE customer_company_id IS NOT NULL;

COMMENT ON COLUMN public.orders.customer_company_id IS 'References customer_companies(id). At most one of customer_person_id and customer_company_id should be set.';
COMMENT ON COLUMN public.orders.customer_company_name IS 'Snapshot of company name when order customer is a company.';

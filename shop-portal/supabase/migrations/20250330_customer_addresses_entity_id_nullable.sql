-- Make customer_entity_id nullable on customer_addresses and customer_bank_accounts
-- so new rows can be inserted with only person_id or company_id (post persons/companies migration).

ALTER TABLE public.customer_addresses
  ALTER COLUMN customer_entity_id DROP NOT NULL;

ALTER TABLE public.customer_bank_accounts
  ALTER COLUMN customer_entity_id DROP NOT NULL;

COMMENT ON COLUMN public.customer_addresses.customer_entity_id IS 'Deprecated: use person_id or company_id. Kept nullable for backward compatibility.';
COMMENT ON COLUMN public.customer_bank_accounts.customer_entity_id IS 'Deprecated: use person_id or company_id. Kept nullable for backward compatibility.';

-- Add foreign key constraints for default addresses in customer_persons and customer_companies

-- Customer persons default addresses
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT IF NOT EXISTS fk_customer_persons_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_persons
    ADD CONSTRAINT IF NOT EXISTS fk_customer_persons_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Customer companies default addresses
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_registered_address 
    FOREIGN KEY (registered_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
    
    ALTER TABLE public.customer_companies
    ADD CONSTRAINT IF NOT EXISTS fk_customer_companies_mailing_address 
    FOREIGN KEY (mailing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key constraints for customer_entities default addresses
-- This migration runs after customer_addresses table is created

-- Add foreign key for default_billing_address_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_entities
    ADD CONSTRAINT fk_customer_entities_default_billing_address 
    FOREIGN KEY (default_billing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for default_shipping_address_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_entities
    ADD CONSTRAINT fk_customer_entities_default_shipping_address 
    FOREIGN KEY (default_shipping_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for registered_address_id (companies only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_entities
    ADD CONSTRAINT fk_customer_entities_registered_address 
    FOREIGN KEY (registered_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for mailing_address_id (companies only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_addresses') THEN
    ALTER TABLE public.customer_entities
    ADD CONSTRAINT fk_customer_entities_mailing_address 
    FOREIGN KEY (mailing_address_id) 
    REFERENCES public.customer_addresses(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

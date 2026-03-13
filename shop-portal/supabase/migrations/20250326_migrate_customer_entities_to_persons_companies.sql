-- Migrate data from customer_entities to customer_persons and customer_companies
-- This migration moves existing data to the new structure

DO $$
DECLARE
  entity_record RECORD;
  new_person_id UUID;
  new_company_id UUID;
  address_record RECORD;
  bank_record RECORD;
  mapping_record RECORD;
BEGIN
  -- Migrate persons
  FOR entity_record IN 
    SELECT * FROM public.customer_entities 
    WHERE entity_type = 'person' AND deleted_at IS NULL
  LOOP
    -- Insert into customer_persons
    INSERT INTO public.customer_persons (
      id,
      firstname,
      lastname,
      email,
      telephone,
      website,
      identifier,
      source,
      customer_group_id,
      is_active,
      tax_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      entity_record.id, -- Keep same ID for easier migration
      COALESCE(entity_record.firstname, ''),
      COALESCE(entity_record.lastname, ''),
      entity_record.email,
      entity_record.telephone,
      entity_record.website,
      entity_record.identifier,
      entity_record.source,
      entity_record.customer_group_id,
      entity_record.is_active,
      entity_record.tax_number, -- Allow tax_number for persons
      entity_record.notes,
      entity_record.created_at,
      entity_record.updated_at,
      entity_record.deleted_at
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO new_person_id;
    
    -- Migrate addresses
    FOR address_record IN 
      SELECT * FROM public.customer_addresses 
      WHERE customer_entity_id = entity_record.id
    LOOP
      UPDATE public.customer_addresses
      SET person_id = entity_record.id,
          company_id = NULL
      WHERE id = address_record.id;
    END LOOP;
    
    -- Migrate bank accounts
    FOR bank_record IN 
      SELECT * FROM public.customer_bank_accounts 
      WHERE customer_entity_id = entity_record.id
    LOOP
      UPDATE public.customer_bank_accounts
      SET person_id = entity_record.id,
          company_id = NULL
      WHERE id = bank_record.id;
    END LOOP;
    
    -- Migrate platform mappings
    FOR mapping_record IN 
      SELECT * FROM public.customer_entity_platform_mappings 
      WHERE customer_entity_id = entity_record.id
    LOOP
      INSERT INTO public.customer_platform_mappings (
        person_id,
        company_id,
        connection_id,
        platform_customer_id,
        platform_inner_id,
        platform_username,
        last_synced_at,
        last_synced_from_platform_at,
        last_synced_to_platform_at,
        created_at,
        updated_at
      ) VALUES (
        entity_record.id,
        NULL,
        mapping_record.connection_id,
        mapping_record.platform_customer_id,
        mapping_record.platform_inner_id,
        mapping_record.platform_username,
        mapping_record.last_synced_at,
        mapping_record.last_synced_from_platform_at,
        mapping_record.last_synced_to_platform_at,
        mapping_record.created_at,
        mapping_record.updated_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  
  -- Migrate companies
  FOR entity_record IN 
    SELECT * FROM public.customer_entities 
    WHERE entity_type = 'company' AND deleted_at IS NULL
  LOOP
    -- Insert into customer_companies
    INSERT INTO public.customer_companies (
      id,
      name,
      email,
      telephone,
      website,
      identifier,
      source,
      customer_group_id,
      is_active,
      default_billing_address_id,
      default_shipping_address_id,
      registered_address_id,
      mailing_address_id,
      tax_number,
      eu_tax_number,
      group_tax_number,
      company_registration_number,
      notes,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      entity_record.id, -- Keep same ID for easier migration
      entity_record.name,
      entity_record.email,
      entity_record.telephone,
      entity_record.website,
      entity_record.identifier,
      entity_record.source,
      entity_record.customer_group_id,
      entity_record.is_active,
      entity_record.default_billing_address_id,
      entity_record.default_shipping_address_id,
      entity_record.registered_address_id,
      entity_record.mailing_address_id,
      entity_record.tax_number,
      entity_record.eu_tax_number,
      entity_record.group_tax_number,
      entity_record.company_registration_number,
      entity_record.notes,
      entity_record.created_at,
      entity_record.updated_at,
      entity_record.deleted_at
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO new_company_id;
    
    -- Migrate addresses
    FOR address_record IN 
      SELECT * FROM public.customer_addresses 
      WHERE customer_entity_id = entity_record.id
    LOOP
      UPDATE public.customer_addresses
      SET person_id = NULL,
          company_id = entity_record.id
      WHERE id = address_record.id;
    END LOOP;
    
    -- Migrate bank accounts
    FOR bank_record IN 
      SELECT * FROM public.customer_bank_accounts 
      WHERE customer_entity_id = entity_record.id
    LOOP
      UPDATE public.customer_bank_accounts
      SET person_id = NULL,
          company_id = entity_record.id
      WHERE id = bank_record.id;
    END LOOP;
    
    -- Migrate platform mappings
    FOR mapping_record IN 
      SELECT * FROM public.customer_entity_platform_mappings 
      WHERE customer_entity_id = entity_record.id
    LOOP
      INSERT INTO public.customer_platform_mappings (
        person_id,
        company_id,
        connection_id,
        platform_customer_id,
        platform_inner_id,
        platform_username,
        last_synced_at,
        last_synced_from_platform_at,
        last_synced_to_platform_at,
        created_at,
        updated_at
      ) VALUES (
        NULL,
        entity_record.id,
        mapping_record.connection_id,
        mapping_record.platform_customer_id,
        mapping_record.platform_inner_id,
        mapping_record.platform_username,
        mapping_record.last_synced_at,
        mapping_record.last_synced_from_platform_at,
        mapping_record.last_synced_to_platform_at,
        mapping_record.created_at,
        mapping_record.updated_at
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: customer_entities data migrated to customer_persons and customer_companies';
END $$;

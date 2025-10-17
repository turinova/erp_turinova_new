require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createAccessoriesTable() {
  console.log('Creating accessories table...')
  
  try {
    // Create the table
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.accessories (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          name character varying(255) NOT NULL,
          sku character varying(100) NOT NULL,
          net_price integer NOT NULL,
          vat_id uuid NOT NULL,
          currency_id uuid NOT NULL,
          units_id uuid NOT NULL,
          partners_id uuid NOT NULL,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now(),
          deleted_at timestamp with time zone NULL,
          CONSTRAINT accessories_pkey PRIMARY KEY (id)
        );
      `
    })

    if (createError) {
      console.error('Error creating table:', createError)
      return
    }

    console.log('Table created successfully!')
    
    // Add foreign key constraints
    const constraints = [
      'ALTER TABLE accessories ADD CONSTRAINT accessories_vat_id_fkey FOREIGN KEY (vat_id) REFERENCES vat(id) ON DELETE RESTRICT;',
      'ALTER TABLE accessories ADD CONSTRAINT accessories_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT;',
      'ALTER TABLE accessories ADD CONSTRAINT accessories_units_id_fkey FOREIGN KEY (units_id) REFERENCES units(id) ON DELETE RESTRICT;',
      'ALTER TABLE accessories ADD CONSTRAINT accessories_partners_id_fkey FOREIGN KEY (partners_id) REFERENCES partners(id) ON DELETE RESTRICT;'
    ]

    for (const constraint of constraints) {
      const { error } = await supabase.rpc('exec_sql', { sql: constraint })
      if (error) {
        console.log('Constraint already exists or error:', error.message)
      }
    }

    console.log('Foreign key constraints added!')
    
    // Create indexes
    const indexes = [
      'CREATE UNIQUE INDEX IF NOT EXISTS accessories_sku_unique_active ON accessories USING btree (sku) WHERE (deleted_at IS NULL);',
      'CREATE INDEX IF NOT EXISTS idx_accessories_deleted_at ON accessories USING btree (deleted_at) WHERE (deleted_at IS NULL);',
      'CREATE INDEX IF NOT EXISTS idx_accessories_name_active ON accessories USING btree (name) WHERE (deleted_at IS NULL);',
      'CREATE INDEX IF NOT EXISTS idx_accessories_sku_active ON accessories USING btree (sku) WHERE (deleted_at IS NULL);'
    ]

    for (const index of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: index })
      if (error) {
        console.log('Index already exists or error:', error.message)
      }
    }

    console.log('Indexes created!')
    
    // Create trigger
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_accessories_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER update_accessories_updated_at
          BEFORE UPDATE ON accessories
          FOR EACH ROW
          EXECUTE FUNCTION update_accessories_updated_at();
      `
    })

    if (triggerError) {
      console.log('Trigger already exists or error:', triggerError.message)
    } else {
      console.log('Trigger created!')
    }

    console.log('Accessories table setup completed successfully!')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

createAccessoriesTable()

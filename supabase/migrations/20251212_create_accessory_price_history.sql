-- Create accessory_price_history table
-- Date: 2025-12-12
-- Purpose: Track all price changes for accessories over time

CREATE TABLE IF NOT EXISTS public.accessory_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessory_id UUID NOT NULL REFERENCES accessories(id) ON DELETE CASCADE,
  old_base_price INTEGER,
  new_base_price INTEGER NOT NULL,
  old_multiplier NUMERIC(3,2),
  new_multiplier NUMERIC(3,2),
  old_net_price INTEGER,
  new_net_price INTEGER NOT NULL,
  old_currency_id UUID REFERENCES currencies(id),
  new_currency_id UUID REFERENCES currencies(id),
  old_vat_id UUID REFERENCES vat(id),
  new_vat_id UUID REFERENCES vat(id),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_type VARCHAR(50) DEFAULT 'edit_page',
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accessory_price_history_accessory_id 
ON public.accessory_price_history(accessory_id);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_changed_at 
ON public.accessory_price_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_changed_by 
ON public.accessory_price_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_old_currency_id 
ON public.accessory_price_history(old_currency_id);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_new_currency_id 
ON public.accessory_price_history(new_currency_id);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_old_vat_id 
ON public.accessory_price_history(old_vat_id);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_new_vat_id 
ON public.accessory_price_history(new_vat_id);

CREATE INDEX IF NOT EXISTS idx_accessory_price_history_source_type 
ON public.accessory_price_history(source_type);

-- Add comments for documentation
COMMENT ON TABLE public.accessory_price_history IS 'Tracks all price changes for accessories over time';
COMMENT ON COLUMN public.accessory_price_history.accessory_id IS 'Reference to the accessory whose price changed';
COMMENT ON COLUMN public.accessory_price_history.old_base_price IS 'Base price before the change';
COMMENT ON COLUMN public.accessory_price_history.new_base_price IS 'Base price after the change';
COMMENT ON COLUMN public.accessory_price_history.old_multiplier IS 'Multiplier before the change';
COMMENT ON COLUMN public.accessory_price_history.new_multiplier IS 'Multiplier after the change';
COMMENT ON COLUMN public.accessory_price_history.old_net_price IS 'Net price before the change';
COMMENT ON COLUMN public.accessory_price_history.new_net_price IS 'Net price after the change';
COMMENT ON COLUMN public.accessory_price_history.changed_by IS 'User who made the price change';
COMMENT ON COLUMN public.accessory_price_history.changed_at IS 'Timestamp when the price was changed';
COMMENT ON COLUMN public.accessory_price_history.source_type IS 'Source of the change: edit_page, excel_import, shipment';
COMMENT ON COLUMN public.accessory_price_history.source_reference IS 'Reference to the source (e.g., shipment_id, filename)';


-- =====================================================
-- Worktop Orders System
-- =====================================================
-- This migration creates:
-- 1. worktop_quote_payments table
-- 2. generate_worktop_quote_order_number() RPC function
-- 3. Indexes and triggers
-- =====================================================

-- =====================================================
-- 1. Create worktop_quote_payments table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.worktop_quote_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  worktop_quote_id uuid NOT NULL,
  amount numeric(10, 2) NOT NULL,
  payment_method text NOT NULL,
  comment text NULL,
  payment_date timestamp without time zone NOT NULL DEFAULT now(),
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  deleted_at timestamp without time zone NULL,
  CONSTRAINT worktop_quote_payments_pkey PRIMARY KEY (id),
  CONSTRAINT worktop_quote_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT worktop_quote_payments_worktop_quote_id_fkey FOREIGN KEY (worktop_quote_id) REFERENCES worktop_quotes (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for worktop_quote_payments
CREATE INDEX IF NOT EXISTS idx_worktop_quote_payments_worktop_quote_id ON public.worktop_quote_payments USING btree (worktop_quote_id) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worktop_quote_payments_payment_date ON public.worktop_quote_payments USING btree (payment_date DESC) TABLESPACE pg_default
WHERE (deleted_at IS NULL);

-- Add comments
COMMENT ON TABLE public.worktop_quote_payments IS 'Payment transactions for worktop orders - supports multiple payments and refunds';
COMMENT ON COLUMN public.worktop_quote_payments.amount IS 'Payment amount - positive for payments, negative for refunds';
COMMENT ON COLUMN public.worktop_quote_payments.payment_method IS 'Payment method: cash, transfer, card';

-- =====================================================
-- 2. Create function to generate worktop quote order number
-- Format: WKO-YYYY-MM-DD-NNN (Worktop Order)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_worktop_quote_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  date_str TEXT;
  next_num INTEGER;
  new_order_number TEXT;
  max_attempts INTEGER := 100; -- Safety limit
  attempt INTEGER := 0;
BEGIN
  -- Format date as YYYY-MM-DD
  date_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
  
  -- Find the highest number (including deleted orders) for this date
  -- Extract the number part after the date (e.g., "WKO-2025-02-08-001" -> "001")
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM LENGTH('WKO-' || date_str || '-') + 1) 
      AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM worktop_quotes
  WHERE order_number LIKE 'WKO-' || date_str || '-%';
  -- NOTE: We check all orders (including deleted) to avoid conflicts
  
  -- Loop until we find an available number
  LOOP
    new_order_number := 'WKO-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    
    -- Check if this number exists (deleted or not)
    IF NOT EXISTS (
      SELECT 1 FROM worktop_quotes WHERE order_number = new_order_number
    ) THEN
      -- Number is available, return it
      RETURN new_order_number;
    END IF;
    
    -- Number exists, try next one
    next_num := next_num + 1;
    attempt := attempt + 1;
    
    -- Safety check to prevent infinite loop
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique worktop order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_worktop_quote_order_number() IS 'Generate unique order number for worktop quotes: WKO-YYYY-MM-DD-NNN';

-- =====================================================
-- 3. Create trigger function to update payment_status
-- =====================================================
-- This will be similar to the quotes payment_status trigger
-- We'll create a function that calculates payment status based on payments

CREATE OR REPLACE FUNCTION public.update_worktop_quote_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_paid numeric(10, 2);
  final_total numeric(12, 2);
  new_status text;
  tolerance numeric(10, 2) := 1.0; -- 1 Ft tolerance for rounding
BEGIN
  -- Get final total and current payments
  SELECT 
    wq.final_total_after_discount,
    COALESCE(SUM(wqp.amount), 0)
  INTO final_total, total_paid
  FROM worktop_quotes wq
  LEFT JOIN worktop_quote_payments wqp ON wqp.worktop_quote_id = wq.id AND wqp.deleted_at IS NULL
  WHERE wq.id = COALESCE(NEW.worktop_quote_id, OLD.worktop_quote_id)
  GROUP BY wq.id, wq.final_total_after_discount;
  
  -- Calculate payment status
  IF total_paid = 0 THEN
    new_status := 'not_paid';
  ELSIF total_paid >= final_total - tolerance THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;
  
  -- Update worktop quote payment_status
  UPDATE worktop_quotes
  SET payment_status = new_status
  WHERE id = COALESCE(NEW.worktop_quote_id, OLD.worktop_quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for payment status updates
DROP TRIGGER IF EXISTS trigger_update_worktop_quote_payment_status ON public.worktop_quote_payments;
CREATE TRIGGER trigger_update_worktop_quote_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.worktop_quote_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_worktop_quote_payment_status();

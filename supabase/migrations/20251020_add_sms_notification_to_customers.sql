-- Add sms_notification column to customers table
ALTER TABLE public.customers
ADD COLUMN sms_notification BOOLEAN NOT NULL DEFAULT false;

-- Add index for filtering by sms_notification status
CREATE INDEX IF NOT EXISTS idx_customers_sms_notification 
ON public.customers USING btree (sms_notification) 
TABLESPACE pg_default 
WHERE (deleted_at IS NULL);

-- Add comment to document the column
COMMENT ON COLUMN public.customers.sms_notification IS 'Indicates whether the customer wants to receive SMS notifications';


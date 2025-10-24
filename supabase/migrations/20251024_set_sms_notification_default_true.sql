-- Change sms_notification default to true for customers table
ALTER TABLE public.customers 
ALTER COLUMN sms_notification SET DEFAULT true;

-- Update existing customers with null or false to true (optional - only if you want to update existing records)
-- UPDATE public.customers 
-- SET sms_notification = true 
-- WHERE sms_notification = false OR sms_notification IS NULL;

-- Add comment explaining the default
COMMENT ON COLUMN public.customers.sms_notification IS 'Indicates whether the customer wants to receive SMS notifications. Defaults to true (opt-out model).';


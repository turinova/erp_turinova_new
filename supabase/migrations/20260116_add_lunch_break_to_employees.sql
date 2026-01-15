-- Add lunch break fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS lunch_break_start TIME,
ADD COLUMN IF NOT EXISTS lunch_break_end TIME;

COMMENT ON COLUMN public.employees.lunch_break_start IS 'Lunch break start time (24-hour format)';
COMMENT ON COLUMN public.employees.lunch_break_end IS 'Lunch break end time (24-hour format)';

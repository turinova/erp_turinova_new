-- Add works_on_saturday column to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS works_on_saturday BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.employees.works_on_saturday IS 'Whether the employee works on Saturdays (default: false)';

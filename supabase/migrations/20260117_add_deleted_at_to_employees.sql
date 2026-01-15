-- Add deleted_at column to employees table for soft delete functionality
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index for filtering non-deleted employees
CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON public.employees(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.employees.deleted_at IS 'Soft delete timestamp - if set, employee is considered deleted';

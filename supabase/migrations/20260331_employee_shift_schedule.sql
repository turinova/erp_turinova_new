-- Planned working hours (paid window) per employee; raw scans unchanged (audit still in attendance_logs).
-- Used to compute paid time vs time before/after schedule in the app.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS shift_start_time TIME,
  ADD COLUMN IF NOT EXISTS shift_end_time TIME,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Budapest';

COMMENT ON COLUMN public.employees.shift_start_time IS 'Planned paid shift start (local business time); NULL = no clipping (paid = actual span minus lunch)';
COMMENT ON COLUMN public.employees.shift_end_time IS 'Planned paid shift end (local business time); NULL = no clipping';
COMMENT ON COLUMN public.employees.timezone IS 'IANA timezone for future business-day edge handling';

-- Both set or both null (optional rule: can set only one later via app validation)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_shift_both_or_neither;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_shift_both_or_neither CHECK (
    (shift_start_time IS NULL AND shift_end_time IS NULL)
    OR (shift_start_time IS NOT NULL AND shift_end_time IS NOT NULL)
  );

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_shift_order;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_shift_order CHECK (
    shift_start_time IS NULL
    OR shift_end_time IS NULL
    OR shift_end_time > shift_start_time
  );

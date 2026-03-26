-- Per-employee overtime settings (disabled by default)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS overtime_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS overtime_grace_minutes INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS overtime_rounding_minutes INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS overtime_rounding_mode TEXT NOT NULL DEFAULT 'floor',
ADD COLUMN IF NOT EXISTS overtime_daily_cap_minutes INTEGER NOT NULL DEFAULT 120,
ADD COLUMN IF NOT EXISTS overtime_requires_complete_day BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_overtime_grace_minutes_check,
  ADD CONSTRAINT employees_overtime_grace_minutes_check CHECK (overtime_grace_minutes >= 0 AND overtime_grace_minutes <= 180);

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_overtime_rounding_minutes_check,
  ADD CONSTRAINT employees_overtime_rounding_minutes_check CHECK (overtime_rounding_minutes >= 1 AND overtime_rounding_minutes <= 60);

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_overtime_daily_cap_minutes_check,
  ADD CONSTRAINT employees_overtime_daily_cap_minutes_check CHECK (overtime_daily_cap_minutes >= 0 AND overtime_daily_cap_minutes <= 1440);

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_overtime_rounding_mode_check,
  ADD CONSTRAINT employees_overtime_rounding_mode_check CHECK (overtime_rounding_mode IN ('floor', 'nearest', 'ceil'));

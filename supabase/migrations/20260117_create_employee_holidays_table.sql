-- Employee Holidays Table
-- This migration creates the employee_holidays table for managing individual employee holidays/vacations

CREATE TABLE IF NOT EXISTS public.employee_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Szabadság', 'Betegszabadság')),
    name TEXT, -- Optional: additional notes/reason
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_employee_holiday UNIQUE (employee_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_holidays_employee_id ON public.employee_holidays(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_holidays_date ON public.employee_holidays(date);
CREATE INDEX IF NOT EXISTS idx_employee_holidays_employee_date ON public.employee_holidays(employee_id, date);

-- Trigger for updated_at
CREATE TRIGGER update_employee_holidays_updated_at
    BEFORE UPDATE ON public.employee_holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.employee_holidays IS 'Individual employee holidays and vacations';
COMMENT ON COLUMN public.employee_holidays.date IS 'Holiday date';
COMMENT ON COLUMN public.employee_holidays.type IS 'Holiday type: Szabadság or Betegszabadság';
COMMENT ON COLUMN public.employee_holidays.name IS 'Optional additional notes or reason for the holiday';

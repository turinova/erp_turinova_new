-- Holidays Management Table
-- This migration creates the holidays table for managing national and company holidays

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('national', 'company')),
    active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT end_date_after_start_date CHECK (end_date >= start_date)
);

-- Unique constraint to prevent duplicate holidays (same name, start_date, end_date) when not deleted
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_unique_active 
    ON public.holidays(name, start_date, end_date) 
    WHERE deleted_at IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_holidays_start_date ON public.holidays(start_date);
CREATE INDEX IF NOT EXISTS idx_holidays_end_date ON public.holidays(end_date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON public.holidays(type);
CREATE INDEX IF NOT EXISTS idx_holidays_active ON public.holidays(active);
CREATE INDEX IF NOT EXISTS idx_holidays_deleted_at ON public.holidays(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_holidays_updated_at
    BEFORE UPDATE ON public.holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.holidays IS 'National and company holidays for attendance system';
COMMENT ON COLUMN public.holidays.name IS 'Holiday name';
COMMENT ON COLUMN public.holidays.start_date IS 'Holiday start date';
COMMENT ON COLUMN public.holidays.end_date IS 'Holiday end date';
COMMENT ON COLUMN public.holidays.type IS 'Holiday type: national or company';
COMMENT ON COLUMN public.holidays.active IS 'Whether the holiday is active';

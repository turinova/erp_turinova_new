-- Attendance System Tables
-- This migration creates the necessary tables for the RFID/PIN attendance tracking system

-- Locations table (one per card scanner)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    device_identifier TEXT, -- USB device identifier (optional)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    employee_code TEXT UNIQUE NOT NULL, -- Unique employee identifier
    rfid_card_id TEXT UNIQUE, -- RFID card ID (nullable, one card per employee)
    pin_code TEXT, -- 4-digit PIN code (stored as-is, nullable)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT pin_code_format CHECK (pin_code IS NULL OR (LENGTH(pin_code) = 4 AND pin_code ~ '^[0-9]{4}$'))
);

-- Attendance logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    scan_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scan_date DATE GENERATED ALWAYS AS ((scan_time AT TIME ZONE 'UTC')::date) STORED, -- Generated column for date part (UTC normalized for immutability)
    scan_type TEXT NOT NULL CHECK (scan_type IN ('arrival', 'departure', 'arrival_pin', 'departure_pin')),
    card_id TEXT, -- RFID card ID if used (nullable)
    pin_used BOOLEAN DEFAULT false, -- True if PIN was used instead of card
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_id ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_location_id ON public.attendance_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_scan_time ON public.attendance_logs(scan_time);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_sync_status ON public.attendance_logs(sync_status);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date ON public.attendance_logs(employee_id, scan_date);

-- Unique index to prevent duplicate scans (same employee, location, date, and scan type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_logs_unique_scan 
    ON public.attendance_logs(employee_id, location_id, scan_date, scan_type);
CREATE INDEX IF NOT EXISTS idx_employees_rfid_card_id ON public.employees(rfid_card_id);
CREATE INDEX IF NOT EXISTS idx_employees_pin_code ON public.employees(pin_code);
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON public.employees(employee_code);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (if using RLS)
-- Enable RLS if needed
-- ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Example: Policy to allow service role to access all data
-- CREATE POLICY "Service role can access all attendance data"
--     ON public.attendance_logs
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Insert default locations (2 scanners)
INSERT INTO public.locations (name, device_identifier) VALUES
    ('Scanner 1', NULL),
    ('Scanner 2', NULL)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.locations IS 'Physical locations where card scanners are installed';
COMMENT ON TABLE public.employees IS 'Employee records with RFID card and PIN code information';
COMMENT ON TABLE public.attendance_logs IS 'Attendance scan logs with arrival/departure tracking';

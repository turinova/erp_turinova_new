-- Fix attendance system - remove problematic unique constraint
-- This allows manual edits while relying on application-level validation

-- Remove the problematic unique constraint that prevents manual edits
-- This constraint was: (employee_id, location_id, scan_date, scan_type)
DROP INDEX IF EXISTS idx_attendance_logs_unique_scan;

-- Add a more flexible unique constraint that allows multiple entries per type
-- but prevents exact duplicate timestamps (which shouldn't happen anyway)
DROP INDEX IF EXISTS idx_attendance_logs_employee_date_type_time;
CREATE UNIQUE INDEX idx_attendance_logs_employee_date_type_time
ON public.attendance_logs(employee_id, scan_date, scan_type, scan_time);

-- Add performance index for queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date_type_time_desc
ON public.attendance_logs(employee_id, scan_date, scan_type, scan_time DESC);

-- Note: Business logic validation (arrival before departure, reasonable time gaps)
-- is handled by application-level validation in the web interface and Raspberry Pi code
-- Diagnostic query to check attendance data for today
-- Run this in production to see what data exists

-- Check if there are attendance logs for today
SELECT 
    'Raw attendance_logs for today' as check_type,
    COUNT(*) as count,
    employee_id,
    scan_date,
    scan_type,
    scan_time,
    manually_edited
FROM public.attendance_logs
WHERE employee_id = '9a11023f-d3f2-483d-b9fc-19a92ad11d7d'
    AND scan_date = CURRENT_DATE
GROUP BY employee_id, scan_date, scan_type, scan_time, manually_edited
ORDER BY scan_time DESC;

-- Check what the view returns for today
SELECT 
    'View attendance_daily_summary for today' as check_type,
    employee_id,
    scan_date,
    latest_arrival_time,
    latest_departure_time,
    arrival_id,
    departure_id,
    arrival_manually_edited,
    departure_manually_edited
FROM public.attendance_daily_summary
WHERE employee_id = '9a11023f-d3f2-483d-b9fc-19a92ad11d7d'
    AND scan_date = CURRENT_DATE;

-- Check if there are multiple logs that might be causing issues
SELECT 
    'Multiple logs check' as check_type,
    scan_date,
    scan_type,
    COUNT(*) as log_count,
    ARRAY_AGG(scan_time ORDER BY scan_time DESC) as scan_times,
    ARRAY_AGG(manually_edited) as manually_edited_flags
FROM public.attendance_logs
WHERE employee_id = '9a11023f-d3f2-483d-b9fc-19a92ad11d7d'
    AND scan_date = CURRENT_DATE
GROUP BY scan_date, scan_type;

-- Verify the view definition
SELECT 
    'View definition' as check_type,
    definition
FROM pg_views
WHERE schemaname = 'public' 
    AND viewname = 'attendance_daily_summary';

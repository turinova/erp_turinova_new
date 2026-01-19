-- Performance optimization for attendance queries
-- This migration creates a view and indexes to speed up attendance data loading

-- ============================================================================
-- ATTENDANCE DAILY SUMMARY VIEW
-- ============================================================================
-- Pre-aggregated view that groups attendance logs by employee and date
-- This eliminates the need for JavaScript processing in the API route

CREATE OR REPLACE VIEW public.attendance_daily_summary AS
WITH ranked_logs AS (
    SELECT 
        employee_id,
        scan_date,
        scan_type,
        scan_time,
        id,
        manually_edited,
        ROW_NUMBER() OVER (
            PARTITION BY employee_id, scan_date, 
            CASE WHEN scan_type IN ('arrival', 'arrival_pin') THEN 'arrival' ELSE 'departure' END
            ORDER BY scan_time DESC
        ) AS rn
    FROM public.attendance_logs
),
arrival_logs AS (
    SELECT 
        employee_id,
        scan_date,
        scan_time AS latest_arrival_time,
        id AS arrival_id,
        COALESCE(manually_edited, false) AS arrival_manually_edited
    FROM ranked_logs
    WHERE scan_type IN ('arrival', 'arrival_pin') AND rn = 1
),
departure_logs AS (
    SELECT 
        employee_id,
        scan_date,
        scan_time AS latest_departure_time,
        id AS departure_id,
        COALESCE(manually_edited, false) AS departure_manually_edited
    FROM ranked_logs
    WHERE scan_type IN ('departure', 'departure_pin') AND rn = 1
)
SELECT 
    COALESCE(a.employee_id, d.employee_id) AS employee_id,
    COALESCE(a.scan_date, d.scan_date) AS scan_date,
    a.latest_arrival_time,
    d.latest_departure_time,
    a.arrival_id,
    d.departure_id,
    COALESCE(a.arrival_manually_edited, false) AS arrival_manually_edited,
    COALESCE(d.departure_manually_edited, false) AS departure_manually_edited
FROM arrival_logs a
FULL OUTER JOIN departure_logs d 
    ON a.employee_id = d.employee_id 
    AND a.scan_date = d.scan_date;

-- Add comment
COMMENT ON VIEW public.attendance_daily_summary IS 
'Pre-aggregated daily attendance summary for fast queries. Groups logs by employee and date, keeping latest arrival/departure. Use this view instead of querying attendance_logs directly for monthly attendance data.';

-- ============================================================================
-- COMPOSITE INDEXES FOR OPTIMIZED QUERIES
-- ============================================================================

-- Optimized composite index for the exact query pattern used in API routes
-- This index covers: employee_id + scan_date + scan_type + scan_time
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date_type_time 
ON public.attendance_logs(employee_id, scan_date, scan_type DESC, scan_time DESC);

-- Index for the view lookups (employee_id + scan_date is the natural key)
-- Note: Views don't have indexes, but the underlying table index helps
-- This index is already covered by the composite index above, but adding explicit one for clarity
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date_lookup 
ON public.attendance_logs(employee_id, scan_date);

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- The view automatically uses the composite indexes when queried
-- Query pattern: SELECT * FROM attendance_daily_summary WHERE employee_id = ? AND scan_date BETWEEN ? AND ?
-- This will be much faster than querying attendance_logs and processing in JavaScript

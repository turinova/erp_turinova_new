-- Fix attendance_daily_summary view to prioritize manually edited logs
-- This ensures that when an admin manually edits arrival/departure times,
-- those edits are always shown instead of being overridden by newer automatic scans

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
            ORDER BY 
                COALESCE(manually_edited, false) DESC,  -- Prioritize manually edited logs first
                scan_time DESC  -- Then by latest time for automatic scans
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

-- Update comment to reflect the new behavior
COMMENT ON VIEW public.attendance_daily_summary IS 
'Pre-aggregated daily attendance summary for fast queries. Groups logs by employee and date, prioritizing manually edited logs over automatic scans. Manually edited times will always be shown even if newer automatic scans exist.';

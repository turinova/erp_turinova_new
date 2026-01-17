-- Add manually_edited flag to attendance_logs
-- This flag marks records that were manually edited by admin
-- Pi scans should not overwrite these records

ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN DEFAULT false;

-- Add index for performance when querying manual edits
CREATE INDEX IF NOT EXISTS idx_attendance_logs_manually_edited 
ON public.attendance_logs(manually_edited) 
WHERE manually_edited = true;

-- Add comment
COMMENT ON COLUMN public.attendance_logs.manually_edited IS 
'True if this record was manually edited by admin. Pi scans should not overwrite these records.';

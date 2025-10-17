-- Check if there are any RLS policies on workers table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'workers';

-- Check if RLS is enabled on workers table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'workers';

-- Check the current structure of workers table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'workers' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

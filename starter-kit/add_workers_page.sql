-- Create workers table
CREATE TABLE IF NOT EXISTS public.workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  mobile character varying(20) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT workers_pkey PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workers_name ON public.workers USING btree (name);
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at ON public.workers USING btree (deleted_at);
CREATE INDEX IF NOT EXISTS idx_workers_active ON public.workers USING btree (deleted_at) WHERE deleted_at IS NULL;

-- Add Dolgozók (Workers) page to the pages table
-- This page will be under Törzsadatok category

INSERT INTO public.pages (
  path,
  name,
  description,
  category,
  is_active,
  created_at,
  updated_at
) VALUES (
  '/workers',
  'Dolgozók',
  'Dolgozók kezelése és adminisztrálása',
  'Törzsadatok',
  true,
  now(),
  now()
);

-- Verify the insertion
SELECT 
  id,
  path,
  name,
  description,
  category,
  is_active,
  created_at
FROM public.pages 
WHERE path = '/workers';

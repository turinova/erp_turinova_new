-- Foot counter: devices + per-event crossings (synced from Raspberry Pi)
-- Reads/writes from main-app API using service role (RLS blocks direct client access).

CREATE TABLE IF NOT EXISTS public.footcounter_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.footcounter_crossings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.footcounter_devices (id) ON DELETE CASCADE,
  client_event_id uuid NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_footcounter_crossings_device_occurred
  ON public.footcounter_crossings (device_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_footcounter_crossings_occurred
  ON public.footcounter_crossings (occurred_at DESC);

ALTER TABLE public.footcounter_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footcounter_crossings ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role bypasses RLS (used by Next.js API routes).

COMMENT ON TABLE public.footcounter_devices IS 'Foot counter edge devices (e.g. Raspberry Pi)';
COMMENT ON TABLE public.footcounter_crossings IS 'Per crossing event; client_event_id is idempotent UUID from device';

-- Default device for single-shop setups (optional; sync API can create devices too)
INSERT INTO public.footcounter_devices (slug, name)
VALUES ('default', 'Bejárat')
ON CONFLICT (slug) DO NOTHING;

-- Dashboard aggregates (Europe/Budapest calendar day for "today" and last 7 local days)
CREATE OR REPLACE FUNCTION public.footcounter_dashboard_stats(p_device_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dev AS (
    SELECT id FROM footcounter_devices WHERE slug = p_device_slug LIMIT 1
  ),
  today_bounds AS (
    SELECT
      ((current_timestamp AT TIME ZONE 'Europe/Budapest')::date)::timestamp
        AT TIME ZONE 'Europe/Budapest' AS start_today,
      (((current_timestamp AT TIME ZONE 'Europe/Budapest')::date + 1)::timestamp)
        AT TIME ZONE 'Europe/Budapest' AS end_today
  ),
  today_counts AS (
    SELECT
      COALESCE(SUM(CASE WHEN c.direction = 'in' THEN 1 ELSE 0 END), 0)::bigint AS in_count,
      COALESCE(SUM(CASE WHEN c.direction = 'out' THEN 1 ELSE 0 END), 0)::bigint AS out_count
    FROM dev
    LEFT JOIN footcounter_crossings c ON c.device_id = dev.id
      AND c.occurred_at >= (SELECT start_today FROM today_bounds)
      AND c.occurred_at < (SELECT end_today FROM today_bounds)
    GROUP BY dev.id
  ),
  last_event AS (
    SELECT max(c.occurred_at) AS at
    FROM footcounter_crossings c
    CROSS JOIN dev
    WHERE c.device_id = dev.id
  ),
  series AS (
    SELECT
      (c.occurred_at AT TIME ZONE 'Europe/Budapest')::date AS day,
      c.direction,
      count(*)::bigint AS cnt
    FROM footcounter_crossings c
    CROSS JOIN dev
    WHERE c.device_id = dev.id
      AND c.occurred_at >= (
        ((current_timestamp AT TIME ZONE 'Europe/Budapest')::date - 6)::timestamp
        AT TIME ZONE 'Europe/Budapest'
      )
    GROUP BY 1, 2
  ),
  series_agg AS (
    SELECT
      day,
      COALESCE(SUM(CASE WHEN direction = 'in' THEN cnt ELSE 0 END), 0) AS in_count,
      COALESCE(SUM(CASE WHEN direction = 'out' THEN cnt ELSE 0 END), 0) AS out_count
    FROM series
    GROUP BY day
  ),
  series_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'day', day::text,
          'in_count', in_count,
          'out_count', out_count
        )
        ORDER BY day
      ),
      '[]'::jsonb
    ) AS days
    FROM series_agg
  )
  SELECT jsonb_build_object(
    'device_slug', p_device_slug,
    'today_in', (SELECT in_count FROM today_counts),
    'today_out', (SELECT out_count FROM today_counts),
    'last_event_at', (SELECT at FROM last_event),
    'device_last_seen', (SELECT last_seen_at FROM footcounter_devices d CROSS JOIN dev WHERE d.id = dev.id),
    'series_7d', (SELECT days FROM series_json)
  )
  FROM dev
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.footcounter_dashboard_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.footcounter_dashboard_stats(text) TO service_role;

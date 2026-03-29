-- Extend POS goals stats with Budapest-calendar per-day counts for the current month.
CREATE OR REPLACE FUNCTION public.get_pos_orders_goal_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_bounds AS (
    SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest')::date AS mstart
  ),
  mend AS (
    SELECT (mstart + interval '1 month - 1 day')::date AS last_d
    FROM month_bounds
  ),
  series AS (
    SELECT generate_series(mb.mstart, me.last_d, interval '1 day')::date AS d
    FROM month_bounds mb
    CROSS JOIN mend me
  ),
  daily_counts AS (
    SELECT
      (po.created_at AT TIME ZONE 'Europe/Budapest')::date AS d,
      count(*)::int AS c
    FROM public.pos_orders po
    CROSS JOIN month_bounds mb
    WHERE po.deleted_at IS NULL
      AND po.status = 'completed'
      AND (po.created_at AT TIME ZONE 'Europe/Budapest') >= mb.mstart
      AND (po.created_at AT TIME ZONE 'Europe/Budapest') < mb.mstart + interval '1 month'
    GROUP BY 1
  ),
  month_daily AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'day', extract(day FROM s.d)::int,
          'count', COALESCE(dc.c, 0)
        )
        ORDER BY s.d
      ),
      '[]'::jsonb
    ) AS j
    FROM series s
    LEFT JOIN daily_counts dc ON dc.d = s.d
  )
  SELECT jsonb_build_object(
    'today_count',
    (
      SELECT count(*)::int
      FROM public.pos_orders po
      WHERE po.deleted_at IS NULL
        AND po.status = 'completed'
        AND (po.created_at AT TIME ZONE 'Europe/Budapest')::date
            = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest')::date
    ),
    'month_count',
    (
      SELECT count(*)::int
      FROM public.pos_orders po
      CROSS JOIN month_bounds mb
      WHERE po.deleted_at IS NULL
        AND po.status = 'completed'
        AND (po.created_at AT TIME ZONE 'Europe/Budapest') >= mb.mstart
        AND (po.created_at AT TIME ZONE 'Europe/Budapest') < mb.mstart + interval '1 month'
    ),
    'today_day',
    (extract(day FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest')::date))::int,
    'days_in_month',
    (SELECT extract(day FROM last_d)::int FROM mend),
    'month_daily',
    (SELECT j FROM month_daily)
  );
$$;

COMMENT ON FUNCTION public.get_pos_orders_goal_stats() IS
  'Completed POS order counts: Budapest today + current month total + per-day counts for calendar month (home goals widget).';

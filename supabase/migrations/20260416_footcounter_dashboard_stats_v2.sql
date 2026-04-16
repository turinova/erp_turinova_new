-- Foot counter: robust dashboard stats (no 1000-row client limit)
-- Aggregates in Postgres with Europe/Budapest calendar day + opening-hours filter.
--
-- Returns JSON compatible with main-app `FootcounterDashboardStats`.

CREATE OR REPLACE FUNCTION public.footcounter_dashboard_stats_v2(
  p_device_slug text,
  p_hours_mode text DEFAULT 'open' -- 'open' | 'all'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  dev AS (
    SELECT id, slug, last_seen_at
    FROM footcounter_devices
    WHERE slug = p_device_slug
    LIMIT 1
  ),
  -- Today's local date in Europe/Budapest
  today_local AS (
    SELECT (current_timestamp AT TIME ZONE 'Europe/Budapest')::date AS d
  ),
  -- Last 7 local dates (including today)
  days_7 AS (
    SELECT (d.d - offs)::date AS day
    FROM today_local d
    CROSS JOIN generate_series(6, 0, -1) AS offs
  ),
  -- Opening-hours predicate implemented in SQL (local Budapest time)
  crossings_scoped AS (
    SELECT
      c.occurred_at,
      c.direction,
      (c.occurred_at AT TIME ZONE 'Europe/Budapest')::timestamp AS local_ts,
      ((c.occurred_at AT TIME ZONE 'Europe/Budapest')::date) AS local_day,
      (extract(isodow from (c.occurred_at AT TIME ZONE 'Europe/Budapest'))::int) AS isodow,
      (extract(hour from (c.occurred_at AT TIME ZONE 'Europe/Budapest'))::int) AS hour_local
    FROM footcounter_crossings c
    JOIN dev ON c.device_id = dev.id
    WHERE c.occurred_at >= (current_timestamp - interval '40 days')
  ),
  crossings_allowed AS (
    SELECT *
    FROM crossings_scoped
    WHERE
      lower(coalesce(p_hours_mode, 'open')) = 'all'
      OR (
        -- Mon–Fri: 08–17 inclusive; Sat: 08–12 inclusive; Sun: closed
        (isodow BETWEEN 1 AND 5 AND hour_local BETWEEN 8 AND 17)
        OR (isodow = 6 AND hour_local BETWEEN 8 AND 12)
      )
  ),
  totals AS (
    SELECT
      COALESCE(sum(CASE WHEN c.direction = 'in' THEN 1 ELSE 0 END), 0)::bigint AS total_in,
      COALESCE(sum(CASE WHEN c.direction = 'out' THEN 1 ELSE 0 END), 0)::bigint AS total_out
    FROM footcounter_crossings c
    JOIN dev ON c.device_id = dev.id
  ),
  last_event AS (
    SELECT max(occurred_at) AS at
    FROM crossings_allowed
  ),
  today_counts AS (
    SELECT
      COALESCE(sum(CASE WHEN direction = 'in' THEN 1 ELSE 0 END), 0)::bigint AS in_count,
      COALESCE(sum(CASE WHEN direction = 'out' THEN 1 ELSE 0 END), 0)::bigint AS out_count
    FROM crossings_allowed
    JOIN today_local t ON crossings_allowed.local_day = t.d
  ),
  series_7d_agg AS (
    SELECT
      d.day,
      COALESCE(sum(CASE WHEN c.direction = 'in' THEN 1 ELSE 0 END), 0)::bigint AS in_count,
      COALESCE(sum(CASE WHEN c.direction = 'out' THEN 1 ELSE 0 END), 0)::bigint AS out_count
    FROM days_7 d
    LEFT JOIN crossings_allowed c ON c.local_day = d.day
    GROUP BY d.day
    ORDER BY d.day
  ),
  series_7d_json AS (
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
    ) AS v
    FROM series_7d_agg
  ),
  hours AS (
    SELECT generate_series(0, 23) AS hour
  ),
  today_hourly AS (
    SELECT
      h.hour,
      COALESCE(sum(CASE WHEN c.direction = 'in' THEN 1 ELSE 0 END), 0)::bigint AS in_count,
      COALESCE(sum(CASE WHEN c.direction = 'out' THEN 1 ELSE 0 END), 0)::bigint AS out_count
    FROM hours h
    CROSS JOIN today_local t
    LEFT JOIN crossings_allowed c
      ON c.local_day = t.d
      AND c.hour_local = h.hour
    GROUP BY h.hour
    ORDER BY h.hour
  ),
  today_hourly_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'hour', hour,
          'in_count', in_count,
          'out_count', out_count
        )
        ORDER BY hour
      ),
      '[]'::jsonb
    ) AS v
    FROM today_hourly
  ),
  heatmap_days AS (
    SELECT (today_local.d - interval '28 days')::date AS cutoff
    FROM today_local
  ),
  -- Heatmap is "in" only, Mon..Sun rows, hour 0..23 columns.
  heatmap_grid AS (
    SELECT
      wd.wd AS weekday_mon0,
      h.hour
    FROM generate_series(0, 6) AS wd(wd)
    CROSS JOIN hours h
  ),
  heatmap_counts AS (
    SELECT
      (c.isodow - 1) AS weekday_mon0,
      c.hour_local AS hour,
      count(*)::bigint AS cnt
    FROM crossings_allowed c
    JOIN heatmap_days hd ON c.local_day >= hd.cutoff
    WHERE c.direction = 'in'
    GROUP BY 1, 2
  ),
  heatmap_cells AS (
    SELECT
      g.weekday_mon0,
      g.hour,
      COALESCE(hc.cnt, 0)::bigint AS cnt
    FROM heatmap_grid g
    LEFT JOIN heatmap_counts hc
      ON hc.weekday_mon0 = g.weekday_mon0
      AND hc.hour = g.hour
    ORDER BY g.weekday_mon0, g.hour
  ),
  heatmap_rows AS (
    SELECT
      weekday_mon0,
      jsonb_agg(cnt ORDER BY hour) AS row_vals
    FROM heatmap_cells
    GROUP BY weekday_mon0
    ORDER BY weekday_mon0
  ),
  heatmap_json AS (
    SELECT COALESCE(jsonb_agg(row_vals ORDER BY weekday_mon0), '[]'::jsonb) AS matrix
    FROM heatmap_rows
  ),
  same_weekday_window AS (
    SELECT
      (today_local.d - interval '35 days')::date AS cutoff,
      (extract(isodow from (current_timestamp AT TIME ZONE 'Europe/Budapest'))::int) AS today_isodow
    FROM today_local
  ),
  same_weekday_days AS (
    SELECT
      local_day AS day,
      sum(CASE WHEN direction = 'in' THEN 1 ELSE 0 END)::bigint AS in_count,
      sum(CASE WHEN direction = 'out' THEN 1 ELSE 0 END)::bigint AS out_count
    FROM crossings_allowed c
    JOIN same_weekday_window w ON true
    JOIN today_local t ON true
    WHERE c.local_day < t.d
      AND c.local_day >= w.cutoff
      AND c.isodow = w.today_isodow
    GROUP BY local_day
  ),
  same_weekday_avg AS (
    SELECT
      count(*)::int AS sample_days,
      avg(in_count)::float8 AS avg_in,
      avg(out_count)::float8 AS avg_out
    FROM same_weekday_days
  )
  SELECT
    CASE
      WHEN (SELECT count(*) FROM dev) = 0 THEN
        jsonb_build_object(
          'device_slug', p_device_slug,
          'today_in', 0,
          'today_out', 0,
          'total_in', 0,
          'total_out', 0,
          'last_event_at', NULL,
          'device_last_seen', NULL,
          'series_7d', (SELECT v FROM series_7d_json),
          'series_today_hourly', (SELECT v FROM today_hourly_json),
          'same_weekday_avg', NULL,
          'heatmap_in', jsonb_build_object('days', 28, 'matrix', (SELECT matrix FROM heatmap_json))
        )
      ELSE
        jsonb_build_object(
          'device_slug', (SELECT slug FROM dev),
          'today_in', (SELECT in_count FROM today_counts),
          'today_out', (SELECT out_count FROM today_counts),
          'total_in', (SELECT total_in FROM totals),
          'total_out', (SELECT total_out FROM totals),
          'last_event_at', (SELECT at FROM last_event),
          'device_last_seen', (SELECT last_seen_at FROM dev),
          'series_7d', (SELECT v FROM series_7d_json),
          'series_today_hourly', (SELECT v FROM today_hourly_json),
          'same_weekday_avg',
            CASE
              WHEN (SELECT sample_days FROM same_weekday_avg) > 0 THEN
                jsonb_build_object(
                  'sample_days', (SELECT sample_days FROM same_weekday_avg),
                  'avg_in', (SELECT avg_in FROM same_weekday_avg),
                  'avg_out', (SELECT avg_out FROM same_weekday_avg),
                  'lookback_days', 35
                )
              ELSE NULL
            END,
          'heatmap_in', jsonb_build_object('days', 28, 'matrix', (SELECT matrix FROM heatmap_json))
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.footcounter_dashboard_stats_v2(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.footcounter_dashboard_stats_v2(text, text) TO service_role;


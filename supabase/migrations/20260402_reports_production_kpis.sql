-- Production-month reporting for main-app /reports (production_date + quote_materials_pricing aggregates).

CREATE OR REPLACE FUNCTION public.get_reports_production_monthly(p_months integer DEFAULT 24)
RETURNS TABLE (
  month timestamptz,
  quote_count bigint,
  quote_revenue_gross numeric,
  cutting_length_m numeric,
  tabla_m2_plus_charged_sqm numeric,
  material_gross_sum numeric,
  edge_materials_gross_sum numeric,
  cutting_gross_sum numeric,
  services_gross_sum numeric,
  lines_gross_sum numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT GREATEST(LEAST(COALESCE(p_months, 24), 60), 1)::int AS m
  ),
  month_lower AS (
    SELECT date_trunc('month', CURRENT_TIMESTAMP) - ((m - 1) || ' months')::interval AS start_month
    FROM bounds
  ),
  filtered_quotes AS (
    SELECT
      q.id,
      q.production_date,
      q.final_total_after_discount
    FROM public.quotes q
    CROSS JOIN month_lower ml
    WHERE q.deleted_at IS NULL
      AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      AND q.production_date IS NOT NULL
      AND date_trunc('month', q.production_date::timestamptz) >= ml.start_month
  ),
  per_quote_month AS (
    SELECT
      date_trunc('month', q.production_date::timestamptz) AS month_bucket,
      (EXTRACT(EPOCH FROM date_trunc('month', q.production_date::timestamptz)))::bigint AS month_join_key,
      COUNT(*)::bigint AS quote_count,
      SUM(q.final_total_after_discount)::numeric AS quote_revenue_gross
    FROM filtered_quotes q
    GROUP BY 1, 2
  ),
  per_line_month AS (
    SELECT
      date_trunc('month', fq.production_date::timestamptz) AS month_bucket,
      (EXTRACT(EPOCH FROM date_trunc('month', fq.production_date::timestamptz)))::bigint AS month_join_key,
      SUM(qmp.cutting_length_m)::numeric AS cutting_length_m,
      SUM(
        (qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0)
        + COALESCE(qmp.charged_sqm, 0)
      )::numeric AS tabla_m2_plus_charged_sqm,
      SUM(qmp.material_gross)::numeric AS material_gross_sum,
      SUM(qmp.edge_materials_gross)::numeric AS edge_materials_gross_sum,
      SUM(qmp.cutting_gross)::numeric AS cutting_gross_sum,
      SUM(qmp.services_gross)::numeric AS services_gross_sum,
      SUM(
        qmp.material_gross + qmp.edge_materials_gross + qmp.cutting_gross + qmp.services_gross
      )::numeric AS lines_gross_sum
    FROM filtered_quotes fq
    INNER JOIN public.quote_materials_pricing qmp ON qmp.quote_id = fq.id
    GROUP BY 1, 2
  )
  SELECT
    COALESCE(p.month_bucket, l.month_bucket) AS month,
    COALESCE(p.quote_count, 0::bigint) AS quote_count,
    COALESCE(p.quote_revenue_gross, 0::numeric) AS quote_revenue_gross,
    COALESCE(l.cutting_length_m, 0::numeric) AS cutting_length_m,
    COALESCE(l.tabla_m2_plus_charged_sqm, 0::numeric) AS tabla_m2_plus_charged_sqm,
    COALESCE(l.material_gross_sum, 0::numeric) AS material_gross_sum,
    COALESCE(l.edge_materials_gross_sum, 0::numeric) AS edge_materials_gross_sum,
    COALESCE(l.cutting_gross_sum, 0::numeric) AS cutting_gross_sum,
    COALESCE(l.services_gross_sum, 0::numeric) AS services_gross_sum,
    COALESCE(l.lines_gross_sum, 0::numeric) AS lines_gross_sum
  FROM per_quote_month p
  FULL OUTER JOIN per_line_month l ON p.month_join_key = l.month_join_key
  ORDER BY month ASC;
$$;

COMMENT ON FUNCTION public.get_reports_production_monthly(integer) IS
  'Monthly aggregates by production_date: quote counts, final_total_after_discount, and quote_materials_pricing gross sums (last N months, max 60).';

CREATE OR REPLACE FUNCTION public.get_reports_production_by_machine(
  p_year integer,
  p_month integer
)
RETURNS TABLE (
  machine_id uuid,
  machine_name text,
  quote_count bigint,
  quote_revenue_gross numeric,
  cutting_length_m numeric,
  tabla_m2_plus_charged_sqm numeric,
  material_gross_sum numeric,
  edge_materials_gross_sum numeric,
  cutting_gross_sum numeric,
  services_gross_sum numeric,
  lines_gross_sum numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_quotes AS (
    SELECT
      q.id,
      q.production_machine_id,
      q.final_total_after_discount
    FROM public.quotes q
    WHERE q.deleted_at IS NULL
      AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      AND q.production_date IS NOT NULL
      AND p_month BETWEEN 1 AND 12
      AND p_year BETWEEN 2000 AND 2100
      AND EXTRACT(YEAR FROM q.production_date::date) = p_year::numeric
      AND EXTRACT(MONTH FROM q.production_date::date) = p_month::numeric
  ),
  rev AS (
    SELECT
      s.machine_join_key,
      (NULLIF(s.machine_join_key, '__no_machine__'))::uuid AS mid,
      COUNT(*)::bigint AS quote_count,
      SUM(s.final_total_after_discount)::numeric AS quote_revenue_gross
    FROM (
      SELECT
        fq.final_total_after_discount,
        COALESCE(fq.production_machine_id::text, '__no_machine__') AS machine_join_key
      FROM filtered_quotes fq
    ) s
    GROUP BY s.machine_join_key
  ),
  lin AS (
    SELECT
      s.machine_join_key,
      (NULLIF(s.machine_join_key, '__no_machine__'))::uuid AS mid,
      SUM(qmp.cutting_length_m)::numeric AS cutting_length_m,
      SUM(
        (qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0)
        + COALESCE(qmp.charged_sqm, 0)
      )::numeric AS tabla_m2_plus_charged_sqm,
      SUM(qmp.material_gross)::numeric AS material_gross_sum,
      SUM(qmp.edge_materials_gross)::numeric AS edge_materials_gross_sum,
      SUM(qmp.cutting_gross)::numeric AS cutting_gross_sum,
      SUM(qmp.services_gross)::numeric AS services_gross_sum,
      SUM(
        qmp.material_gross + qmp.edge_materials_gross + qmp.cutting_gross + qmp.services_gross
      )::numeric AS lines_gross_sum
    FROM (
      SELECT
        fq.id,
        COALESCE(fq.production_machine_id::text, '__no_machine__') AS machine_join_key
      FROM filtered_quotes fq
    ) s
    INNER JOIN public.quote_materials_pricing qmp ON qmp.quote_id = s.id
    GROUP BY s.machine_join_key
  )
  SELECT
    COALESCE(rev.mid, lin.mid) AS machine_id,
    CASE
      WHEN COALESCE(rev.mid, lin.mid) IS NULL THEN 'Nincs hozzárendelve'
      ELSE COALESCE(pm.machine_name, 'Ismeretlen gép')
    END AS machine_name,
    COALESCE(rev.quote_count, 0::bigint) AS quote_count,
    COALESCE(rev.quote_revenue_gross, 0::numeric) AS quote_revenue_gross,
    COALESCE(lin.cutting_length_m, 0::numeric) AS cutting_length_m,
    COALESCE(lin.tabla_m2_plus_charged_sqm, 0::numeric) AS tabla_m2_plus_charged_sqm,
    COALESCE(lin.material_gross_sum, 0::numeric) AS material_gross_sum,
    COALESCE(lin.edge_materials_gross_sum, 0::numeric) AS edge_materials_gross_sum,
    COALESCE(lin.cutting_gross_sum, 0::numeric) AS cutting_gross_sum,
    COALESCE(lin.services_gross_sum, 0::numeric) AS services_gross_sum,
    COALESCE(lin.lines_gross_sum, 0::numeric) AS lines_gross_sum
  FROM rev
  FULL OUTER JOIN lin ON rev.machine_join_key = lin.machine_join_key
  LEFT JOIN public.production_machines pm
    ON pm.id = COALESCE(rev.mid, lin.mid)
    AND pm.deleted_at IS NULL
  ORDER BY quote_revenue_gross DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_reports_production_by_machine(integer, integer) IS
  'Per-machine production_month aggregates (production_date calendar year/month): quote revenue and quote_materials_pricing gross sums.';

GRANT EXECUTE ON FUNCTION public.get_reports_production_monthly(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_production_monthly(integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_reports_production_by_machine(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_production_by_machine(integer, integer) TO service_role;

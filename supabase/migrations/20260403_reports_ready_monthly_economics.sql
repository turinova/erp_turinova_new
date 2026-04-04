-- Ready-month (ready_at) economics for /reports: revenue mix from qmp, material contribution net (multiplier model), waste proxy.

CREATE OR REPLACE FUNCTION public.get_reports_ready_monthly_economics(p_months integer DEFAULT 24)
RETURNS TABLE (
  month timestamptz,
  quote_count bigint,
  quote_revenue_gross numeric,
  material_gross_sum numeric,
  cutting_gross_sum numeric,
  edge_materials_gross_sum numeric,
  services_gross_sum numeric,
  lines_gross_sum numeric,
  cutting_length_m numeric,
  charged_board_m2 numeric,
  material_contribution_net_sum numeric,
  full_board_pricing_lines bigint,
  total_pricing_lines bigint
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
      q.ready_at,
      q.final_total_after_discount
    FROM public.quotes q
    CROSS JOIN month_lower ml
    WHERE q.deleted_at IS NULL
      AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      AND q.ready_at IS NOT NULL
      AND date_trunc('month', q.ready_at::timestamptz) >= ml.start_month
  ),
  per_quote_month AS (
    SELECT
      date_trunc('month', q.ready_at::timestamptz) AS month_bucket,
      (EXTRACT(EPOCH FROM date_trunc('month', q.ready_at::timestamptz)))::bigint AS month_join_key,
      COUNT(*)::bigint AS quote_count,
      SUM(q.final_total_after_discount)::numeric AS quote_revenue_gross
    FROM filtered_quotes q
    GROUP BY 1, 2
  ),
  line_month AS (
    SELECT
      date_trunc('month', fq.ready_at::timestamptz) AS month_bucket,
      (EXTRACT(EPOCH FROM date_trunc('month', fq.ready_at::timestamptz)))::bigint AS month_join_key,
      SUM(qmp.material_gross)::numeric AS material_gross_sum,
      SUM(qmp.cutting_gross)::numeric AS cutting_gross_sum,
      SUM(qmp.edge_materials_gross)::numeric AS edge_materials_gross_sum,
      SUM(qmp.services_gross)::numeric AS services_gross_sum,
      SUM(
        qmp.material_gross + qmp.edge_materials_gross + qmp.cutting_gross + qmp.services_gross
      )::numeric AS lines_gross_sum,
      SUM(qmp.cutting_length_m)::numeric AS cutting_length_m,
      SUM(
        (qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0)
        + COALESCE(qmp.charged_sqm, 0)
      )::numeric AS charged_board_m2,
      SUM(
        CASE
          WHEN qmp.material_net > 0 AND m.id IS NOT NULL AND COALESCE(m.multiplier, 0::numeric) > 0::numeric
          THEN qmp.material_net - (qmp.material_net / m.multiplier)
          ELSE 0::numeric
        END
      )::numeric AS material_contribution_net_sum,
      COUNT(*) FILTER (WHERE qmp.pricing_method = 'full_board')::bigint AS full_board_pricing_lines,
      COUNT(*)::bigint AS total_pricing_lines
    FROM filtered_quotes fq
    INNER JOIN public.quote_materials_pricing qmp ON qmp.quote_id = fq.id
    LEFT JOIN public.materials m ON m.id = qmp.material_id
    GROUP BY 1, 2
  )
  SELECT
    COALESCE(p.month_bucket, l.month_bucket) AS month,
    COALESCE(p.quote_count, 0::bigint) AS quote_count,
    COALESCE(p.quote_revenue_gross, 0::numeric) AS quote_revenue_gross,
    COALESCE(l.material_gross_sum, 0::numeric) AS material_gross_sum,
    COALESCE(l.cutting_gross_sum, 0::numeric) AS cutting_gross_sum,
    COALESCE(l.edge_materials_gross_sum, 0::numeric) AS edge_materials_gross_sum,
    COALESCE(l.services_gross_sum, 0::numeric) AS services_gross_sum,
    COALESCE(l.lines_gross_sum, 0::numeric) AS lines_gross_sum,
    COALESCE(l.cutting_length_m, 0::numeric) AS cutting_length_m,
    COALESCE(l.charged_board_m2, 0::numeric) AS charged_board_m2,
    COALESCE(l.material_contribution_net_sum, 0::numeric) AS material_contribution_net_sum,
    COALESCE(l.full_board_pricing_lines, 0::bigint) AS full_board_pricing_lines,
    COALESCE(l.total_pricing_lines, 0::bigint) AS total_pricing_lines
  FROM per_quote_month p
  FULL OUTER JOIN line_month l ON p.month_join_key = l.month_join_key
  ORDER BY month ASC;
$$;

COMMENT ON FUNCTION public.get_reports_ready_monthly_economics(integer) IS
  'Monthly aggregates by ready_at: quote totals, qmp gross mix, material net contribution (material_net - material_net/multiplier), full_board line count as waste proxy.';

GRANT EXECUTE ON FUNCTION public.get_reports_ready_monthly_economics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_ready_monthly_economics(integer) TO service_role;

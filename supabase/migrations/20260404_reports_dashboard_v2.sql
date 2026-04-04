-- Riportok dashboard v2: time-series with edge length, top customers, top materials.
-- All production_date based, excludes deleted / draft / cancelled quotes.

DROP FUNCTION IF EXISTS public.get_reports_dashboard_series(date, date, text);
DROP FUNCTION IF EXISTS public.get_reports_top_customers(date, date, integer);
DROP FUNCTION IF EXISTS public.get_reports_top_materials(date, date, integer);

---------------------------------------------------------------------
-- 1) Time-series aggregates (day / week / month granularity)
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reports_dashboard_series(
  p_start date,
  p_end date,
  p_granularity text DEFAULT 'month'
)
RETURNS TABLE (
  period          timestamptz,
  quote_count     bigint,
  cutting_length_m         numeric,
  tabla_m2                 numeric,
  edge_length_m            numeric,
  material_gross           numeric,
  cutting_gross            numeric,
  edge_materials_gross     numeric,
  services_gross           numeric,
  lines_gross_total        numeric,
  estimated_material_cost  numeric,
  estimated_material_profit numeric,
  production_days          bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gran text;
BEGIN
  v_gran := CASE
    WHEN p_granularity IN ('day', 'week', 'month') THEN p_granularity
    ELSE 'month'
  END;

  RETURN QUERY
  WITH filtered_quotes AS (
    SELECT q.id, q.production_date
    FROM public.quotes q
    WHERE q.deleted_at IS NULL
      AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      AND q.production_date IS NOT NULL
      AND q.production_date >= p_start
      AND q.production_date <= p_end
  ),
  qmp_per_quote AS (
    SELECT
      qmp.quote_id,
      SUM(qmp.cutting_length_m)::numeric                               AS cutting_length_m,
      SUM(
        (qmp.boards_used::numeric * qmp.board_width_mm::numeric
         * qmp.board_length_mm::numeric / 1000000.0)
        + COALESCE(qmp.charged_sqm, 0)
      )::numeric                                                        AS tabla_m2,
      SUM(qmp.material_gross)::numeric                                  AS material_gross,
      SUM(qmp.cutting_gross)::numeric                                   AS cutting_gross,
      SUM(qmp.edge_materials_gross)::numeric                            AS edge_materials_gross,
      SUM(qmp.services_gross)::numeric                                  AS services_gross,
      SUM(qmp.material_gross + qmp.edge_materials_gross
          + qmp.cutting_gross + qmp.services_gross)::numeric            AS lines_gross_total,
      SUM(
        (
          qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0
          + COALESCE(qmp.charged_sqm, 0) / NULLIF(qmp.waste_multi, 0)
        ) * COALESCE(m.base_price, 0) * (1 + qmp.vat_rate)
      )::numeric                                                        AS estimated_material_cost
    FROM public.quote_materials_pricing qmp
    LEFT JOIN public.materials m ON m.id = qmp.material_id
    WHERE qmp.quote_id IN (SELECT fq.id FROM filtered_quotes fq)
    GROUP BY qmp.quote_id
  ),
  edge_per_quote AS (
    SELECT
      qmp.quote_id,
      SUM(qemb.total_length_m)::numeric AS edge_length_m
    FROM public.quote_materials_pricing qmp
    INNER JOIN public.quote_edge_materials_breakdown qemb
      ON qemb.quote_materials_pricing_id = qmp.id
    WHERE qmp.quote_id IN (SELECT fq.id FROM filtered_quotes fq)
    GROUP BY qmp.quote_id
  )
  SELECT
    date_trunc(v_gran, fq.production_date::timestamptz) AS period,
    COUNT(DISTINCT fq.id)::bigint                       AS quote_count,
    COALESCE(SUM(qpq.cutting_length_m), 0)::numeric    AS cutting_length_m,
    COALESCE(SUM(qpq.tabla_m2), 0)::numeric            AS tabla_m2,
    COALESCE(SUM(epq.edge_length_m), 0)::numeric       AS edge_length_m,
    COALESCE(SUM(qpq.material_gross), 0)::numeric      AS material_gross,
    COALESCE(SUM(qpq.cutting_gross), 0)::numeric       AS cutting_gross,
    COALESCE(SUM(qpq.edge_materials_gross), 0)::numeric AS edge_materials_gross,
    COALESCE(SUM(qpq.services_gross), 0)::numeric      AS services_gross,
    COALESCE(SUM(qpq.lines_gross_total), 0)::numeric   AS lines_gross_total,
    COALESCE(SUM(qpq.estimated_material_cost), 0)::numeric AS estimated_material_cost,
    (COALESCE(SUM(qpq.material_gross), 0) - COALESCE(SUM(qpq.estimated_material_cost), 0))::numeric AS estimated_material_profit,
    COUNT(DISTINCT fq.production_date)::bigint AS production_days
  FROM filtered_quotes fq
  LEFT JOIN qmp_per_quote qpq ON qpq.quote_id = fq.id
  LEFT JOIN edge_per_quote epq ON epq.quote_id = fq.id
  GROUP BY 1
  ORDER BY 1;
END;
$$;

COMMENT ON FUNCTION public.get_reports_dashboard_series(date, date, text) IS
  'Time-bucketed production aggregates: qmp gross mix, edge length, per granularity (day/week/month).';

---------------------------------------------------------------------
-- 2) Top customers by total gross (production_date range)
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reports_top_customers(
  p_start date,
  p_end date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  customer_id   uuid,
  customer_name text,
  quote_count   bigint,
  total_gross   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id                                       AS customer_id,
    c.name::text                               AS customer_name,
    COUNT(DISTINCT q.id)::bigint               AS quote_count,
    SUM(q.final_total_after_discount)::numeric AS total_gross
  FROM public.quotes q
  INNER JOIN public.customers c ON c.id = q.customer_id
  WHERE q.deleted_at IS NULL
    AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
    AND q.production_date IS NOT NULL
    AND q.production_date >= p_start
    AND q.production_date <= p_end
  GROUP BY c.id, c.name
  ORDER BY total_gross DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 50), 1);
$$;

COMMENT ON FUNCTION public.get_reports_top_customers(date, date, integer) IS
  'Top N customers by final_total_after_discount within production_date range.';

---------------------------------------------------------------------
-- 3) Top materials by gross or m² (production_date range)
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reports_top_materials(
  p_start date,
  p_end date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  material_id    uuid,
  material_name  text,
  thickness_mm   integer,
  material_gross numeric,
  tabla_m2       numeric,
  quote_count    bigint,
  estimated_cost numeric,
  estimated_profit numeric,
  on_stock boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    qmp.material_id,
    qmp.material_name::text,
    qmp.thickness_mm,
    SUM(qmp.material_gross)::numeric AS material_gross,
    SUM(
      (qmp.boards_used::numeric * qmp.board_width_mm::numeric
       * qmp.board_length_mm::numeric / 1000000.0)
      + COALESCE(qmp.charged_sqm, 0)
    )::numeric                       AS tabla_m2,
    COUNT(DISTINCT qmp.quote_id)::bigint AS quote_count,
    SUM(
      (
        qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0
        + COALESCE(qmp.charged_sqm, 0) / NULLIF(qmp.waste_multi, 0)
      ) * COALESCE(m.base_price, 0) * (1 + qmp.vat_rate)
    )::numeric                       AS estimated_cost,
    (SUM(qmp.material_gross) - SUM(
      (
        qmp.boards_used::numeric * qmp.board_width_mm::numeric * qmp.board_length_mm::numeric / 1000000.0
        + COALESCE(qmp.charged_sqm, 0) / NULLIF(qmp.waste_multi, 0)
      ) * COALESCE(m.base_price, 0) * (1 + qmp.vat_rate)
    ))::numeric                      AS estimated_profit,
    BOOL_AND(COALESCE(m.on_stock, false)) AS on_stock
  FROM public.quote_materials_pricing qmp
  INNER JOIN public.quotes q ON q.id = qmp.quote_id
  LEFT JOIN public.materials m ON m.id = qmp.material_id
  WHERE q.deleted_at IS NULL
    AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
    AND q.production_date IS NOT NULL
    AND q.production_date >= p_start
    AND q.production_date <= p_end
  GROUP BY qmp.material_id, qmp.material_name, qmp.thickness_mm
  ORDER BY material_gross DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 10), 50), 1);
$$;

COMMENT ON FUNCTION public.get_reports_top_materials(date, date, integer) IS
  'Top N materials by material_gross within production_date range (includes m², estimated cost & profit).';

---------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_reports_dashboard_series(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_dashboard_series(date, date, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_reports_top_customers(date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_top_customers(date, date, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_reports_top_materials(date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_top_materials(date, date, integer) TO service_role;

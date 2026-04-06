-- Customer dashboard stats: summary KPIs, monthly revenue trend,
-- revenue breakdown, top materials, and recent orders for a single customer.

DROP FUNCTION IF EXISTS public.get_customer_summary(uuid);

---------------------------------------------------------------------
-- 1) Customer summary KPIs (counts ALL statuses including draft)
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_summary(p_customer_id uuid)
RETURNS TABLE (
  total_quotes        bigint,
  total_orders        bigint,
  total_revenue       numeric,
  avg_order_value     numeric,
  first_order_date    date,
  last_order_date     date,
  days_since_last     integer,
  draft_value         numeric,
  status_draft        bigint,
  status_accepted     bigint,
  status_ordered      bigint,
  status_in_production bigint,
  status_ready        bigint,
  status_done         bigint,
  status_finished     bigint,
  cancelled_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint                                                        AS total_quotes,
    COUNT(*) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status))::bigint AS total_orders,
    COALESCE(SUM(q.final_total_after_discount) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)), 0)::numeric AS total_revenue,
    COALESCE(AVG(q.final_total_after_discount) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)), 0)::numeric AS avg_order_value,
    MIN(q.production_date) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)) AS first_order_date,
    MAX(q.production_date) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)) AS last_order_date,
    COALESCE((CURRENT_DATE - MAX(q.production_date) FILTER (WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)))::integer, 0) AS days_since_last,
    COALESCE(SUM(q.final_total_after_discount) FILTER (WHERE q.status = 'draft'::public.quote_status), 0)::numeric AS draft_value,
    COUNT(*) FILTER (WHERE q.status = 'draft'::public.quote_status)::bigint     AS status_draft,
    COUNT(*) FILTER (WHERE q.status = 'accepted'::public.quote_status)::bigint  AS status_accepted,
    COUNT(*) FILTER (WHERE q.status = 'ordered'::public.quote_status)::bigint   AS status_ordered,
    COUNT(*) FILTER (WHERE q.status = 'in_production'::public.quote_status)::bigint AS status_in_production,
    COUNT(*) FILTER (WHERE q.status = 'ready'::public.quote_status)::bigint     AS status_ready,
    COUNT(*) FILTER (WHERE q.status = 'done'::public.quote_status)::bigint      AS status_done,
    COUNT(*) FILTER (WHERE q.status = 'finished'::public.quote_status)::bigint  AS status_finished,
    COUNT(*) FILTER (WHERE q.status = 'cancelled'::public.quote_status)::bigint AS cancelled_count
  FROM public.quotes q
  WHERE q.customer_id = p_customer_id
    AND q.deleted_at IS NULL;
$$;

---------------------------------------------------------------------
-- 2) Monthly revenue trend (last 12 months)
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_monthly_revenue(p_customer_id uuid)
RETURNS TABLE (
  month       timestamptz,
  revenue     numeric,
  order_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', q.production_date::timestamptz) AS month,
    SUM(q.final_total_after_discount)::numeric          AS revenue,
    COUNT(*)::bigint                                     AS order_count
  FROM public.quotes q
  WHERE q.customer_id = p_customer_id
    AND q.deleted_at IS NULL
    AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
    AND q.production_date IS NOT NULL
    AND q.production_date >= (CURRENT_DATE - INTERVAL '12 months')
  GROUP BY 1
  ORDER BY 1;
$$;

---------------------------------------------------------------------
-- 3) Revenue breakdown by category
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_revenue_breakdown(p_customer_id uuid)
RETURNS TABLE (
  material_gross       numeric,
  cutting_gross        numeric,
  edge_materials_gross numeric,
  services_gross       numeric,
  fees_gross           numeric,
  accessories_gross    numeric,
  cutting_length_m     numeric,
  tabla_m2             numeric,
  edge_length_m        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid_quotes AS (
    SELECT q.id, q.fees_total_gross, q.accessories_total_gross
    FROM public.quotes q
    WHERE q.customer_id = p_customer_id
      AND q.deleted_at IS NULL
      AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      AND q.production_date IS NOT NULL
  ),
  mat AS (
    SELECT
      COALESCE(SUM(qmp.material_gross), 0)::numeric           AS material_gross,
      COALESCE(SUM(qmp.cutting_gross), 0)::numeric            AS cutting_gross,
      COALESCE(SUM(qmp.edge_materials_gross), 0)::numeric     AS edge_materials_gross,
      COALESCE(SUM(qmp.services_gross), 0)::numeric           AS services_gross,
      COALESCE(SUM(qmp.cutting_length_m), 0)::numeric         AS cutting_length_m,
      COALESCE(SUM(
        (qmp.boards_used::numeric * qmp.board_width_mm::numeric
         * qmp.board_length_mm::numeric / 1000000.0)
        + COALESCE(qmp.charged_sqm, 0)
      ), 0)::numeric                                           AS tabla_m2
    FROM public.quote_materials_pricing qmp
    WHERE qmp.quote_id IN (SELECT id FROM valid_quotes)
  ),
  edg AS (
    SELECT COALESCE(SUM(qemb.total_length_m), 0)::numeric AS edge_length_m
    FROM public.quote_edge_materials_breakdown qemb
    INNER JOIN public.quote_materials_pricing qmp ON qmp.id = qemb.quote_materials_pricing_id
    WHERE qmp.quote_id IN (SELECT id FROM valid_quotes)
  ),
  totals AS (
    SELECT
      COALESCE(SUM(vq.fees_total_gross), 0)::numeric        AS fees_gross,
      COALESCE(SUM(vq.accessories_total_gross), 0)::numeric AS accessories_gross
    FROM valid_quotes vq
  )
  SELECT
    mat.material_gross,
    mat.cutting_gross,
    mat.edge_materials_gross,
    mat.services_gross,
    totals.fees_gross,
    totals.accessories_gross,
    mat.cutting_length_m,
    mat.tabla_m2,
    edg.edge_length_m
  FROM mat, edg, totals;
$$;

---------------------------------------------------------------------
-- 4) Top materials for customer
---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_top_materials(
  p_customer_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  material_id   uuid,
  material_name text,
  thickness_mm  integer,
  material_gross numeric,
  tabla_m2      numeric,
  quote_count   bigint
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
    COUNT(DISTINCT qmp.quote_id)::bigint AS quote_count
  FROM public.quote_materials_pricing qmp
  INNER JOIN public.quotes q ON q.id = qmp.quote_id
  WHERE q.customer_id = p_customer_id
    AND q.deleted_at IS NULL
    AND q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
    AND q.production_date IS NOT NULL
  GROUP BY qmp.material_id, qmp.material_name, qmp.thickness_mm
  ORDER BY material_gross DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 5), 20), 1);
$$;

---------------------------------------------------------------------
-- 5) All quotes for customer (chronological)
---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_customer_recent_orders(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_customer_recent_orders(
  p_customer_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  quote_id       uuid,
  quote_number   text,
  order_number   text,
  production_date date,
  created_at     timestamptz,
  status         text,
  total_gross    numeric,
  payment_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id                                AS quote_id,
    q.quote_number::text                AS quote_number,
    q.order_number::text                AS order_number,
    q.production_date,
    q.created_at,
    q.status::text                      AS status,
    q.final_total_after_discount::numeric AS total_gross,
    q.payment_status::text              AS payment_status
  FROM public.quotes q
  WHERE q.customer_id = p_customer_id
    AND q.deleted_at IS NULL
  ORDER BY q.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 100), 1);
$$;

---------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_customer_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_monthly_revenue(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_revenue_breakdown(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_top_materials(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_recent_orders(uuid, integer) TO authenticated, service_role;

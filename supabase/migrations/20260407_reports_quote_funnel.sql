-- Quote funnel for /reports: created_at (Budapest calendar day) vs status.

CREATE OR REPLACE FUNCTION public.get_reports_quote_funnel(
  p_start date,
  p_end date
)
RETURNS TABLE (
  total_quotes           bigint,
  draft_count            bigint,
  draft_value_gross      numeric,
  won_count              bigint,
  won_value_gross        numeric,
  cancelled_count        bigint,
  cancelled_value_gross  numeric,
  conversion_pct         numeric,
  draft_share_pct        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT
      q.status,
      COALESCE(q.final_total_after_discount, 0)::numeric AS gross
    FROM public.quotes q
    WHERE q.deleted_at IS NULL
      AND ((q.created_at AT TIME ZONE 'Europe/Budapest')::date) BETWEEN p_start AND p_end
  )
  SELECT
    COUNT(*)::bigint AS total_quotes,
    COUNT(*) FILTER (WHERE w.status = 'draft'::public.quote_status)::bigint AS draft_count,
    COALESCE(SUM(gross) FILTER (WHERE w.status = 'draft'::public.quote_status), 0)::numeric AS draft_value_gross,
    COUNT(*) FILTER (WHERE w.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status))::bigint AS won_count,
    COALESCE(SUM(gross) FILTER (WHERE w.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)), 0)::numeric AS won_value_gross,
    COUNT(*) FILTER (WHERE w.status = 'cancelled'::public.quote_status)::bigint AS cancelled_count,
    COALESCE(SUM(gross) FILTER (WHERE w.status = 'cancelled'::public.quote_status), 0)::numeric AS cancelled_value_gross,
    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE w.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status))::numeric
        / NULLIF(COUNT(*)::numeric, 0),
        1
      ),
      0
    )::numeric AS conversion_pct,
    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE w.status = 'draft'::public.quote_status)::numeric
        / NULLIF(COUNT(*)::numeric, 0),
        1
      ),
      0
    )::numeric AS draft_share_pct
  FROM w;
$$;

COMMENT ON FUNCTION public.get_reports_quote_funnel(date, date) IS
  'Counts quotes by status for created_at (Europe/Budapest day) in range; conversion = won / total.';

GRANT EXECUTE ON FUNCTION public.get_reports_quote_funnel(date, date) TO authenticated, service_role;

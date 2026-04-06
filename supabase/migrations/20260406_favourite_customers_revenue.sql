-- Favourite customers with lifetime + average monthly revenue (for /favourite grid)

CREATE OR REPLACE FUNCTION public.get_favourite_customers_with_revenue()
RETURNS TABLE (
  id                   uuid,
  name                 text,
  email                text,
  mobile               text,
  discount_percent     numeric,
  total_revenue        numeric,
  avg_monthly_revenue  numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_customer AS (
    SELECT
      c.id AS cid,
      c.name,
      c.email,
      c.mobile,
      COALESCE(c.discount_percent, 0)::numeric AS disc,
      COALESCE(
        SUM(q.final_total_after_discount) FILTER (
          WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
        ),
        0
      )::numeric AS tr,
      MIN(q.production_date) FILTER (
        WHERE q.status NOT IN ('draft'::public.quote_status, 'cancelled'::public.quote_status)
      ) AS first_order_date
    FROM public.customers c
    LEFT JOIN public.quotes q ON q.customer_id = c.id AND q.deleted_at IS NULL
    WHERE c.is_favorite = true
      AND c.deleted_at IS NULL
    GROUP BY c.id, c.name, c.email, c.mobile, c.discount_percent
  )
  SELECT
    cid AS id,
    name::text,
    COALESCE(email, '')::text,
    COALESCE(mobile, '')::text,
    disc AS discount_percent,
    tr AS total_revenue,
    CASE
      WHEN first_order_date IS NULL OR tr = 0 THEN 0::numeric
      ELSE tr / GREATEST(
        1,
        (
          (EXTRACT(YEAR FROM AGE(CURRENT_DATE, first_order_date::date))::bigint * 12)
          + EXTRACT(MONTH FROM AGE(CURRENT_DATE, first_order_date::date))::bigint
          + 1
        )
      )
    END AS avg_monthly_revenue
  FROM per_customer
  ORDER BY avg_monthly_revenue DESC NULLS LAST, total_revenue DESC, name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_favourite_customers_with_revenue() TO authenticated, service_role;

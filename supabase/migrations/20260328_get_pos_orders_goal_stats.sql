-- Read-only aggregates for home dashboard POS goals (Europe/Budapest calendar).
CREATE OR REPLACE FUNCTION public.get_pos_orders_goal_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHERE po.deleted_at IS NULL
        AND po.status = 'completed'
        AND (po.created_at AT TIME ZONE 'Europe/Budapest')
            >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest')
        AND (po.created_at AT TIME ZONE 'Europe/Budapest')
            < date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest')
               + interval '1 month'
    )
  );
$$;

COMMENT ON FUNCTION public.get_pos_orders_goal_stats() IS
  'Completed, non-deleted POS order counts for Budapest calendar today and current month (home goals widget).';

GRANT EXECUTE ON FUNCTION public.get_pos_orders_goal_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_orders_goal_stats() TO service_role;

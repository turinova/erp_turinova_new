-- Open-Meteo napi időjárás snapshot — authenticated SELECT (day-keyed, nem tenant adat).
-- /belepok weather join a user Supabase klienssel.

DO $$
BEGIN
  IF to_regclass('public.footcounter_daily_weather') IS NULL THEN
    RAISE NOTICE 'footcounter_daily_weather missing — skip policy';
    RETURN;
  END IF;

  ALTER TABLE public.footcounter_daily_weather ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS footcounter_daily_weather_select_authenticated
    ON public.footcounter_daily_weather;
  CREATE POLICY footcounter_daily_weather_select_authenticated
    ON public.footcounter_daily_weather
    FOR SELECT
    TO authenticated
    USING (true);
END $$;

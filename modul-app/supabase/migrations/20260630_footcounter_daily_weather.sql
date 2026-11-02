-- Open-Meteo napi időjárás snapshot (day-keyed, nem tenant adat).
-- Forrás: root supabase 20260624 + 20260627 rain + 20260717 wind.
-- Futtasd a Supabase SQL Editorben (vagy CLI), ha a /belepok weather join hibázik.

CREATE TABLE IF NOT EXISTS public.footcounter_daily_weather (
  day date PRIMARY KEY,
  condition text NOT NULL DEFAULT 'unknown',
  temp_max_c real,
  temp_min_c real,
  precipitation_mm real,
  weather_code int,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  precip_open_hours_mm real,
  rain_hours_open smallint,
  is_significant_rain_open boolean,
  wind_speed_10m_max_kmh real,
  wind_gusts_10m_max_kmh real,
  wind_speed_open_max_kmh real,
  wind_speed_open_avg_kmh real,
  is_significant_wind_open boolean
);

COMMENT ON TABLE public.footcounter_daily_weather IS
  'Daily weather snapshot (Open-Meteo) for footfall correlation; keyed by Europe/Budapest calendar day.';

COMMENT ON COLUMN public.footcounter_daily_weather.precip_open_hours_mm IS
  'Összcsapadék 8:00–17:00 között (mm), Open-Meteo óránkénti adat.';
COMMENT ON COLUMN public.footcounter_daily_weather.rain_hours_open IS
  'Hány órában volt ≥0,5 mm csapadék 8:00–17:00 között.';
COMMENT ON COLUMN public.footcounter_daily_weather.is_significant_rain_open IS
  'Esős nap: ≥2 egymást követő óra ≥0,5 mm/óra a nyitvatartási ablakban és összesen ≥1 mm.';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_10m_max_kmh IS
  'Napi max szélsebesség 10 m (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_gusts_10m_max_kmh IS
  'Napi max széllökés 10 m (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_open_max_kmh IS
  'Max óránkénti szél 8:00–17:00 között (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_open_avg_kmh IS
  'Átlag óránkénti szél 8:00–17:00 között (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.is_significant_wind_open IS
  'Szeles nap: 8–17 max ≥25 km/h VAGY átlag ≥18 km/h.';

-- Idempotens oszlopok, ha a tábla már létezett a régi sémával.
ALTER TABLE public.footcounter_daily_weather
  ADD COLUMN IF NOT EXISTS precip_open_hours_mm real,
  ADD COLUMN IF NOT EXISTS rain_hours_open smallint,
  ADD COLUMN IF NOT EXISTS is_significant_rain_open boolean,
  ADD COLUMN IF NOT EXISTS wind_speed_10m_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_gusts_10m_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_speed_open_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_speed_open_avg_kmh real,
  ADD COLUMN IF NOT EXISTS is_significant_wind_open boolean;

ALTER TABLE public.footcounter_daily_weather ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS footcounter_daily_weather_select_authenticated
  ON public.footcounter_daily_weather;
CREATE POLICY footcounter_daily_weather_select_authenticated
  ON public.footcounter_daily_weather
  FOR SELECT
  TO authenticated
  USING (true);

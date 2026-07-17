-- Footcounter: szél a nyitvatartási ablakban (8:00–17:00) + napi max/lökés.
-- RUN MANUALLY in Supabase SQL editor.
--
-- Szeles nap (app logika): 8–17 között max szél ≥25 km/h VAGY átlag ≥18 km/h
-- (Kecskemét nyári tipikus tartós szél ~10–20 km/h; 40/30 gyakorlatilag soha nem teljesül).

ALTER TABLE public.footcounter_daily_weather
  ADD COLUMN IF NOT EXISTS wind_speed_10m_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_gusts_10m_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_speed_open_max_kmh real,
  ADD COLUMN IF NOT EXISTS wind_speed_open_avg_kmh real,
  ADD COLUMN IF NOT EXISTS is_significant_wind_open boolean;

COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_10m_max_kmh IS
  'Napi max szélsebesség 10 m (km/h), Open-Meteo wind_speed_10m_max.';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_gusts_10m_max_kmh IS
  'Napi max széllökés 10 m (km/h), Open-Meteo wind_gusts_10m_max.';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_open_max_kmh IS
  'Max óránkénti szél 8:00–17:00 között (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.wind_speed_open_avg_kmh IS
  'Átlag óránkénti szél 8:00–17:00 között (km/h).';
COMMENT ON COLUMN public.footcounter_daily_weather.is_significant_wind_open IS
  'Szeles nap: 8–17 max ≥25 km/h VAGY átlag ≥18 km/h.';

-- Opcionális: month_weather JSON bővítése az RPC-ben (attachMonthWeather() a DB-ből mindenképp lekéri).
-- Cseréld a footcounter_dashboard_stats_v2 month_weather_json CTE-t erre:
--
--   month_weather_json AS (
--     SELECT COALESCE(
--       jsonb_agg(
--         jsonb_build_object(
--           'day', md.day::text,
--           'condition', COALESCE(w.condition, 'unknown'),
--           'temp_max_c', w.temp_max_c,
--           'temp_min_c', w.temp_min_c,
--           'precipitation_mm', w.precipitation_mm,
--           'precip_open_hours_mm', w.precip_open_hours_mm,
--           'rain_hours_open', w.rain_hours_open,
--           'is_significant_rain_open', w.is_significant_rain_open,
--           'wind_speed_10m_max_kmh', w.wind_speed_10m_max_kmh,
--           'wind_gusts_10m_max_kmh', w.wind_gusts_10m_max_kmh,
--           'wind_speed_open_max_kmh', w.wind_speed_open_max_kmh,
--           'wind_speed_open_avg_kmh', w.wind_speed_open_avg_kmh,
--           'is_significant_wind_open', w.is_significant_wind_open
--         )
--         ORDER BY md.day
--       ),
--       '[]'::jsonb
--     ) AS v
--     FROM month_days md
--     LEFT JOIN footcounter_daily_weather w ON w.day = md.day
--   ),

-- =============================================================================
-- b2b-portal / 007_seed_platform_admin.sql
-- MANUÁLISAN futtasd — előtte: 001–006
--
-- 1) Generálj bcrypt hash-t (cost 12), pl.:
--    cd b2b-portal && npx --yes bcryptjs-cli hash "A_JELSZAVAD" 12
--    vagy a repo password helperrel telepítés után.
-- 2) Cseréld ki az EMAIL és PASSWORD_HASH értékeket lent.
-- 3) Futtasd ezt a fájlt owner / b2b_admin joggal
--    (RLS miatt: set_config('app.is_platform_admin','true', true) VAGY table owner).
-- =============================================================================

-- Ha RLS blokkol (FORCE), ideiglenesen session bypass a seedhez:
select set_config('app.is_platform_admin', 'true', true);

insert into public.users (
  email,
  password_hash,
  display_name,
  is_platform_admin
)
values (
  'admin@turinova.hu',                          -- ← EMAIL
  '$2b$12$VtuTPUNUjIiZxkoPiQIp/eoBE2ep0oBoXzcocDnl5jwzzuK9ptJii',    -- ← PASSWORD_HASH
  'Turinova Platform',
  true
)
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  is_platform_admin = true,
  display_name = excluded.display_name,
  updated_at = now();

insert into public.schema_migrations (filename)
values ('007_seed_platform_admin.sql')
on conflict (filename) do nothing;

-- Ellenőrzés:
-- select id, email, is_platform_admin from public.users where is_platform_admin;

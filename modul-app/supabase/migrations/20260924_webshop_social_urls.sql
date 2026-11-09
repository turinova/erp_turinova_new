-- Storefront footer social links (nullable HTTPS URLs). Shared lean footer for all tenants.

alter table public.tenant_webshop_settings
  add column if not exists social_facebook text,
  add column if not exists social_instagram text,
  add column if not exists social_youtube text,
  add column if not exists social_tiktok text,
  add column if not exists social_linkedin text;

alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_social_facebook_chk;
alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_social_instagram_chk;
alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_social_youtube_chk;
alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_social_tiktok_chk;
alter table public.tenant_webshop_settings
  drop constraint if exists tenant_webshop_settings_social_linkedin_chk;

alter table public.tenant_webshop_settings
  add constraint tenant_webshop_settings_social_facebook_chk
    check (social_facebook is null or social_facebook ~* '^https://'),
  add constraint tenant_webshop_settings_social_instagram_chk
    check (social_instagram is null or social_instagram ~* '^https://'),
  add constraint tenant_webshop_settings_social_youtube_chk
    check (social_youtube is null or social_youtube ~* '^https://'),
  add constraint tenant_webshop_settings_social_tiktok_chk
    check (social_tiktok is null or social_tiktok ~* '^https://'),
  add constraint tenant_webshop_settings_social_linkedin_chk
    check (social_linkedin is null or social_linkedin ~* '^https://');

comment on column public.tenant_webshop_settings.social_facebook is 'Bolt lábléc: Facebook profil URL.';
comment on column public.tenant_webshop_settings.social_instagram is 'Bolt lábléc: Instagram profil URL.';
comment on column public.tenant_webshop_settings.social_youtube is 'Bolt lábléc: YouTube csatorna URL.';
comment on column public.tenant_webshop_settings.social_tiktok is 'Bolt lábléc: TikTok profil URL.';
comment on column public.tenant_webshop_settings.social_linkedin is 'Bolt lábléc: LinkedIn oldal URL.';

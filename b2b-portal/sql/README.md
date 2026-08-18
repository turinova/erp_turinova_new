# SQL migrations — manuális futtatás

**Az alkalmazás NEM futtatja ezeket automatikusan.**

Sorrend és részletek: [`../docs/DATABASE.md`](../docs/DATABASE.md)  
Architektúra: [`../docs/SAAS_ARCHITECTURE.md`](../docs/SAAS_ARCHITECTURE.md)

```
001_extensions_and_helpers.sql
002_tenancy_auth.sql
003_shops_and_credentials.sql
004_widget_settings.sql
005_audit_events.sql
006_rls_policies.sql
007_seed_platform_admin.sql   ← szerkeszd mielőtt futtatod
008_shop_customer_group_map.sql
009_shop_customers.sql
010_b2b_orders.sql
011_rls_customers.sql
012_shop_customer_activities.sql
013_commerce_catalog.sql
014_sync_jobs.sql
015_org_stats_and_limits.sql   ← starter → start; plan_defaults
016_partner_meter_and_orders.sql
017_rls_commerce.sql
018_platform_settings.sql     ← trial napok, sync concurrency (M5)
```

Supabase: SQL Editor → paste → Run → következő.  
psql: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/00X_....sql`

**Vevők (008–012):** manuálisan, sorrendben.  
**Commerce + meter (013–017):** M1 — katalógus séma, plan enum, Active Partner függvények. Az app NEM futtatja.

# Database — manuális futtatás + séma referencia

**Fontos:** az SQL fájlokat **te futtatod** (Supabase SQL Editor / `psql`).  
Az app **nem** futtat migrációt bootoláskor.

Teljes termékterv: [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md)  
Commerce catalog · sync · **Active Partner** billing · admin stats: [`PLATFORM_AND_ADMIN_IMPLEMENTATION.md`](./PLATFORM_AND_ADMIN_IMPLEMENTATION.md)

---

## 1. Előfeltételek

1. **Dedikált** Postgres adatbázis a B2B SaaS-nak  
   - Ne a shop-portal tenant DB  
   - Ne a main ERP DB  
   - Supabase: új project ajánlott (`b2b-portal` / `turinova-b2b`)
2. Jogosultság: `CREATE` táblákra, extensionre (`pgcrypto`)
3. Mentés / snapshot a futtatás előtt (prod)

---

## 2. Futtatási sorrend

Könyvtár: `b2b-portal/sql/`

| # | Fájl | Mit csinál |
|---|------|------------|
| 1 | `001_extensions_and_helpers.sql` | pgcrypto, updated_at, schema_migrations |
| 2 | `002_tenancy_auth.sql` | orgs, users, memberships, invitations, sessions |
| 3 | `003_shops_and_credentials.sql` | shops, credentials, origins |
| 4 | `004_widget_settings.sql` | widget_settings |
| 5 | `005_audit_events.sql` | audit_events |
| 6 | `006_rls_policies.sql` | RLS policies (app role) |
| 7 | `007_seed_platform_admin.sql` | **szerkeszd** majd futtasd — első platform admin |
| 8 | `008_shop_customer_group_map.sql` | Shoprenter csoport → gomb/bolt/rejtett |
| 9 | `009_shop_customers.sql` | Vékony vevő ujjlenyomat |
| 10 | `010_b2b_orders.sql` | Widget rendelés fact |
| 11 | `011_rls_customers.sql` | RLS vevő/order táblákra |
| 12 | `012_shop_customer_activities.sql` | Aktivitás napló |
| 13 | `013_commerce_catalog.sql` | `product_catalog` (typeahead tükör) |
| 14 | `014_sync_jobs.sql` | Sync jobs/cursors + shop catalog oszlopok |
| 15 | `015_org_stats_and_limits.sql` | Plan `start\|grow\|pro\|scale`; `plan_defaults`; `organization_stats` |
| 16 | `016_partner_meter_and_orders.sql` | Active Partner függvények + `widget_opens` |
| 17 | `017_rls_commerce.sql` | RLS catalog/sync/stats/opens |

**M1:** futtasd `013`→`017` ezen a sorrenden. `015` kötelező, mielőtt új orgot hozol létre (`start`/`grow`/`pro`/`scale`) — a `002` még `starter`\|`pro` checket hagy.

### Supabase SQL Editor

1. Nyisd meg a projectet → SQL → New query  
2. Másold be a fájl **teljes** tartalmát  
3. Run  
4. Ellenőrizd: nincs error  
5. Következő fájl  

### psql

```bash
export DATABASE_URL="postgresql://..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/001_extensions_and_helpers.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/002_tenancy_auth.sql
# ... stb.
```

### Nyilvántartás

Minden sikeres fájl végén van:

```sql
insert into schema_migrations (filename) values ('00X_....sql')
on conflict do nothing;
```

Ellenőrzés:

```sql
select * from schema_migrations order by applied_at;
```

---

## 3. Környezeti változók (portal)

`b2b-portal/.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3030

# Direct Postgres (ajánlott a portal serverhez)
DATABASE_URL=postgresql://USER:PASS@HOST:5432/postgres

# Shoprenter credential encryption — 32 byte hex (64 karakter)
# openssl rand -hex 32
CREDENTIALS_ENCRYPTION_KEY=

# Session cookie signing (későbbi auth)
# openssl rand -hex 32
SESSION_SECRET=
```

Supabase-nél: Settings → Database → Connection string (URI).  
**Session / Transaction mode pooler:** az app transaction-scoped `SET LOCAL`-t használ RLS-hez — transaction pooler OK, ha minden request saját tranzakció.

---

## 4. Tábla referencia

### schema_migrations
| Oszlop | Típus | Leírás |
|--------|-------|--------|
| filename | text PK | SQL fájlnév |
| applied_at | timestamptz | mikor |

### organizations
| Oszlop | Megjegyzés |
|--------|------------|
| id | uuid PK |
| name | megjelenő név |
| slug | unique, URL-barát |
| status | trial \| active \| suspended |
| plan | `start` \| `grow` \| `pro` \| `scale` (launch; Free nincs) |
| trial_ends_at | nullable; create-kor typically now+30d |
| sku_limit_override | nullable; `015` |
| partner_limit_override | nullable; `015` |
| created_at / updated_at | |

> Plan catch-up: `015` átírja a régi `starter` értéket `start`-ra. Az app típusa `PlanId` = start\|grow\|pro\|scale.

### users
| Oszlop | Megjegyzés |
|--------|------------|
| id | uuid PK |
| email | unique, lowercased app oldalon |
| password_hash | nullable amíg invite pending / magic |
| display_name | |
| is_platform_admin | Turinova staff |
| last_login_at | |
| disabled_at | soft block |

### memberships
| Oszlop | Megjegyzés |
|--------|------------|
| organization_id + user_id | unique |
| role | owner \| admin \| member |

### invitations
| Oszlop | Megjegyzés |
|--------|------------|
| token_hash | sha256 hex — plaintext soha |
| email | invite cél |
| role | általában owner az elsőnél |
| status | pending \| accepted \| revoked \| expired |
| expires_at | |
| Partial unique | egy pending / (org, lower(email)) |

### sessions
| Oszlop | Megjegyzés |
|--------|------------|
| id | uuid (cookie value lehet random id) |
| user_id | |
| active_organization_id | nullable (platform-only user) |
| expires_at | |
| revoked_at | |

### shops
| Oszlop | Megjegyzés |
|--------|------------|
| organization_id | FK cascade |
| shoprenter_shop_name | **global unique** |
| store_url | |
| public_id | widget id, unique, nem titok |
| status | draft \| active \| needs_reauth \| suspended \| uninstalled |
| widget_enabled | kill switch |
| last_ping_at / last_ping_ok | |
| platform | `014` — default `shoprenter` |
| catalog_status / catalog_product_count / catalog_ready_at | `014` |
| purged_at | `014` — uninstall soft retain |

### product_catalog (013)
Vékony katalógus-tükör typeaheadhez. Unique `(shop_id, sku_norm)` és `(shop_id, external_product_id)`.

### sync_jobs + sync_cursors (014)
Egy queued\|running job / shop. Worker (M2) tölti.

### plan_defaults + organization_stats (015)
Launch limitek (Start 15 / Grow 30 / Pro 80 / Scale 200 partner). Stats materialize később (M5/M9).

### widget_opens (016)
Analitika — **nem** billing. Active Partner = `count_active_partners_month(org, month)` a `b2b_orders` felett (`source='widget'`).

### b2b_orders + shop_customer_group_moves (010)
Widget rendelés fact (lines jsonb) + átrakás history. Riport / billing gerinc. A widget `POST /api/orders` írja kosárba rakáskor.

### shop_credentials
| Oszlop | Megjegyzés |
|--------|------------|
| shop_id | 1:1 |
| auth_type | oauth \| basic_legacy |
| ciphertext / iv / key_version | AES-GCM |
| token_expires_at | oauth |

### shop_allowed_origins
| Oszlop | Megjegyzés |
|--------|------------|
| shop_id | |
| origin | pl. `https://vasalatmester.hu` unique per shop |

### widget_settings
| Oszlop | Megjegyzés |
|--------|------------|
| shop_id | 1:1 |
| button_label | |
| customer_group_ids | int[] — **derived** from `shop_customer_group_map` where role=`gomb` (üres = senki) |
| settings | jsonb flags |

### shop_customer_group_map (008)
| Oszlop | Megjegyzés |
|--------|------------|
| shop_id | tenant shop |
| sr_group_inner_id | Shoprenter `userGroupId` |
| sr_group_id | API outer id |
| sr_name_snapshot | UI |
| role | `bolt` \| `gomb` \| `rejtett` |

### shop_customers (009)
Vékony ujjlenyomat (nem full CRM). Touch / átrakás / widget fact.

### audit_events
| Oszlop | Megjegyzés |
|--------|------------|
| organization_id | nullable platform actionnél |
| actor_user_id | |
| action | text pl. `invite.sent`, `customer.group_moved` |
| meta | jsonb |

---

## 5. RLS röviden

- App role: `b2b_app` (006 létrehozza, ha hiányzik)
- Session változó: `app.organization_id` (uuid text)
- Platform bypass: külön `b2b_admin` role **vagy** app kódban service connection superuser nélkül + explicit policy

**Figyelem:** migrációkat általában owner/superuser futtatja — RLS owner bypass ellen `FORCE ROW LEVEL SECURITY` kell (006).

Az alkalmazás connection stringje **ne** superuser legyen productionben.

---

## 6. Seed — első platform admin

1. Generálj password hash-t (Node, a repo `src/lib/auth/password.ts` helperrel, ha már telepítve):

```bash
cd b2b-portal && node -e "const b=require('bcryptjs'); b.hash('IDE_JELSZO',12).then(console.log)"
```

2. Szerkeszd `007_seed_platform_admin.sql` email + hash  
3. Futtasd  
4. Login később a portálon ezzel az emaillel

---

## 7. Rollback

Nincs automatikus down migráció v1-ben. Ha elrontottad fresh projecten:

```sql
-- VESZÉLYES — csak üres / dev DB-n
drop schema public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;
```

Majd futtasd újra 001→017.

Prod: restore snapshot.

---

## 8. Ellenőrző checklist futtatás után

```sql
select filename from schema_migrations order by filename;
-- elvárt M1 után: 001 … 017

select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;

select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('organizations','shops','memberships');
```

- [ ] `schema_migrations` 7 sor (007 után)
- [ ] `shops.shoprenter_shop_name` unique
- [ ] `invitations` partial unique pending
- [ ] RLS enabled + forced a tenant táblákon
- [ ] `.env.local` `DATABASE_URL` + encryption key

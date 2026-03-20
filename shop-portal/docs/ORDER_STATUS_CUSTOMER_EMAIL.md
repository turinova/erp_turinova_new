# Order status → customer e-mail (ERP)

- **UI:** Beállítások → **Rendelés e-mail értesítések** (`/settings/email/order-notifications`).
- **Feladó:** Beállítások → E-mail → **Csatornák** → „Rendelés státusz” identitás (vagy alapértelmezett küldő).
- **ShopRenter:** a webshop rendelés státusza **nem** frissül; csak a vevő e-mailben kap értesítést, ha a sor **aktív** és van `customer_email`.
- **Duplikáció:** ugyanarra az `(order_id, státusz)` mérföldkőre csak **egyszer** küldünk (`order_status_notification_log`).
- **Változók:** többek között `{{customer_firstname}}`, `{{order_number}}`, `{{status_label}}`, `{{payment_method_name}}`, `{{shipping_method_name}}`, `{{tracking_number}}` (ha nincs követés: **—**). `{{order_items_table}}` — szerver generálja a tételeket (kép, név, cikkszám, menny., sor bruttó; lábléc: rendelés bruttó végösszege). Csak a **levéltörzsben** használja (tárgyban figyelmen kívül hagyjuk).
- **Migrációk (tenant):** `20250421_order_status_email_notifications.sql`, `20250421_add_order_status_notifications_page_permissions.sql`  
  **Admin:** `20250421_tenant_migration_list_order_status_notifications.sql`

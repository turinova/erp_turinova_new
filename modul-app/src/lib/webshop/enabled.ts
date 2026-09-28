/**
 * Webshop modul főkapcsoló. Jegelve (2026-09-28): false → nincs menü, bolt, API, cron,
 * add-on bekapcsolás; az adatok és a kód megmaradnak. Visszakapcsolás: docs/39-webshop.md.
 * Kódkonstans (nem env), hogy szerveren, kliensen és edge middleware-ben is ugyanaz legyen.
 */
export const WEBSHOP_ENABLED: boolean = false

/**
 * Webshop modul főkapcsoló.
 * W1 (2026-11-05): true — soft unlock (Live + Agent Top kapuk). Stripe / GTM: docs/50-webshop-w1.md.
 * Kódkonstans (nem env), hogy szerveren, kliensen és edge middleware-ben is ugyanaz legyen.
 */
export const WEBSHOP_ENABLED: boolean = true

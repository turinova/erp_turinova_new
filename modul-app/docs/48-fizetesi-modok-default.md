# Fizetési módok — alapértelmezett

**Route:** `/torzsadatok/rendszer/fizetesi-modok`  
**Migráció:** `20260633_payment_methods_is_default.sql`

## Zárolt döntések

1. `payment_methods.is_default` — max **1** élő default / tenant (unique partial index).
2. Default csak **aktív** lehet.
3. ≥1 aktív mód → legyen 1 aktív default (első create auto-default).
4. Select picker: `pickDefaultPaymentMethodId` — `preferTransfer` → `is_default` → cash-név → lista első.
5. Partner `preferred_payment_method_*` ≠ shop default.
6. Sale record unpaid/díjbekérő: `preferTransfer` (utalás) elsőbbség.

## UI

- Lista: **Alap** badge + **Alapnak** gomb.
- Dialog: Aktív / Alapértelmezett Switch.
- Default törlés / inaktiválás: tilos csere nélkül.

## Helper

`lib/payment-methods/default.ts` → `pickDefaultPaymentMethodId`.

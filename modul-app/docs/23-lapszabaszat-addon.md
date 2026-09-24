# Lapszabászat add-on

Opti / ajánlat / megrendelés / anyag / gép stack — **nem** része az Alap plannak.

| | |
|---|---|
| Key | `lapszabaszat` |
| Ár | **10 000 Ft / hó** nettó |
| Migration | `20260430_lapszabaszat_addon.sql`, `20260922_lapszabaszat_includes_partner_sms.sql` |

## Mit nyit

- `/opti`, `/ajanlatok`, `/megrendelesek`, `/scanner`
- Táblás / szálas / élzárók
- Gyártógépek, berendezés
- Opti beállítások

**Nem** része: ügyfelek, gyártók, termékek, média, Belépők.

## A csomag részei

| Add-on | Szabály |
|---|---|
| `partner_orders` | A Lapszabászattal automatikusan bekapcsol; külön havidíja nincs |
| `quote_ready_sms` | A Lapszabászattal automatikusan bekapcsol; 89 Ft nettó / kiküldött SMS |

Lapszabászat kikapcsolásakor ezek is automatikusan kikapcsolódnak.

## Nav

Sidebar **Lapszabászat** csoport: Árajánlatok, Megrendelések.
Opti és Scanner top-level menüpontok maradnak (entitlement továbbra is a Lapszabászat add-onhoz kötött).

**Workflow (státusz + detail CTA):** [37-lapszabaszat-quote-workflow.md](37-lapszabaszat-quote-workflow.md).

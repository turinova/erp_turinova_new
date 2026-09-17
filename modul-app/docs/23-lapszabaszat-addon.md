# Lapszabászat add-on

Opti / ajánlat / megrendelés / anyag / gép stack — **nem** része az Alap plannak.

| | |
|---|---|
| Key | `lapszabaszat` |
| Ár | **10 000 Ft / hó** nettó |
| Migration | `20260430_lapszabaszat_addon.sql` |

## Mit nyit

- `/opti`, `/ajanlatok`, `/megrendelesek`, `/scanner`
- Táblás / szálas / élzárók
- Gyártógépek, berendezés
- Opti beállítások

**Nem** része: ügyfelek, gyártók, termékek, média, Belépők.

## Függő add-onok

| Add-on | Szabály |
|---|---|
| `partner_orders` | Csak ha Lapszabászat be van |
| `quote_ready_sms` | Csak ha Lapszabászat be van |

Lapszabászat kikapcsolás → ezek auto lekapcsolódnak.

## Nav

Sidebar **Lapszabászat** csoport: Árajánlatok, Megrendelések.
Opti és Scanner top-level menüpontok maradnak (entitlement továbbra is a Lapszabászat add-onhoz kötött).

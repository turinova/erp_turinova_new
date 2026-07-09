-- =============================================================================
-- Építő Ártükör — DDC-CWICR PL (Warszawa) normagyűjtemény seed
-- Forrás: datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR (CC BY 4.0)
-- Árfolyam: 1 PLN = 82.8 HUF | Generálva: convert_pl_track.py
-- Előfeltétel: 001–007 migrációk lefutottak (trades, categories, units, cost_items)
-- =============================================================================

insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, null, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    ('epitomester', 'DDC-EM-01', 'Alapozás', 1),
    ('epitomester', 'DDC-EM-02', 'Befejező (szakipari) munkák', 2),
    ('epitomester', 'DDC-EM-03', 'Egyéb javítási és építési munkák', 3),
    ('epitomester', 'DDC-EM-04', 'Előregyártott beton- és vasbeton szerkezetek', 4),
    ('epitomester', 'DDC-EM-05', 'Falak', 5),
    ('epitomester', 'DDC-EM-06', 'Faszerkezetek', 6),
    ('epitomester', 'DDC-EM-07', 'Festési munkák', 7),
    ('epitomester', 'DDC-EM-08', 'Földmunkák', 8),
    ('epitomester', 'DDC-EM-09', 'Lépcsők, verandák', 9),
    ('epitomester', 'DDC-EM-10', 'Mennyezetek', 10),
    ('epitomester', 'DDC-EM-11', 'Monolit beton- és vasbeton szerkezetek', 11),
    ('epitomester', 'DDC-EM-12', 'Padlóburkolatok', 12),
    ('epitomester', 'DDC-EM-13', 'Szigetelési munkák', 13),
    ('epitomester', 'DDC-EM-14', 'Tetőfedés', 14),
    ('epitomester', 'DDC-EM-15', 'Tetők, tetőszerkezetek', 15),
    ('epitomester', 'DDC-EM-16', 'Tégla- és blokkfalazatok', 16),
    ('epitomester', 'DDC-EM-17', 'Vakolási munkák', 17),
    ('epitomester', 'DDC-EM-18', 'Válaszfalak', 18),
    ('epitomester', 'DDC-EM-19', 'Épületfelújítási munkák', 19),
    ('nyilaszaró', 'DDC-NY-01', 'Nyílások, nyílászáró-beépítés', 1),
    ('nyilaszaró', 'DDC-NY-02', 'Üvegezési és befejező munkák', 2),
    ('gepeszet', 'DDC-GE-01', 'Belső csővezetékek', 1),
    ('gepeszet', 'DDC-GE-02', 'Csővezeték és csatorna — belső szerelvények', 2),
    ('gepeszet', 'DDC-GE-03', 'Fűtésszerelés (belső)', 3),
    ('gepeszet', 'DDC-GE-04', 'Gázszerelés (belső)', 4),
    ('gepeszet', 'DDC-GE-05', 'Szellőzés és klíma', 5),
    ('gepeszet', 'DDC-GE-06', 'Szellőző- és klímarendszerek', 6),
    ('gepeszet', 'DDC-GE-07', 'Épületen belüli víz- és szennyvízszerelés', 7),
    ('elektromos', 'DDC-EL-01', 'Elektromos szerelések', 1),
    ('elektromos', 'DDC-EL-02', 'Villanyszerelési munkák', 2),
    ('riaszto', 'DDC-RI-01', 'Kommunikációs és jelzőhálózatok', 1)
) as v(trade, code, name, sort_order)
where o.slug = 'demo'
  and not exists (
    select 1 from public.categories c
    where c.organization_id = o.id
      and lower(c.code) = lower(v.code)
      and c.deleted_at is null
  );

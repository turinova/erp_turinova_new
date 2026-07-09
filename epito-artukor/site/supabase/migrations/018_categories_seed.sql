-- =============================================================================
-- Építő Ártükör — Kategória seed (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 017_trades_seed.sql már lefutott
--
-- Lapos kategória-lista (nincsenek ernyő-/gyökérkategóriák), szakáganként
-- 2–6 db, TERC munkanem-fejezetek + építésvezetői gyakorlat szerint:
--   - a sorrend az építési fázisokat követi (alapszerelés → szerelvényezés),
--   - csak olyan kategória van, ami a tételek keresését ténylegesen segíti,
--   - az "elokeszites" szakág a teljes projektköltség puha oldalát
--     (tervezés, engedélyezés, közműfejlesztés) fedi le.
--
-- Minden szervezetre fut, idempotens (kód alapú upsert). Az 1. blokk a régi
-- 004-es seed ernyő-kategóriáit és a DDC (lengyel) kategóriákat soft-deleteli
-- — de csak akkor, ha nem hivatkozik rájuk aktív tétel.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Régi seed-kategóriák takarítása (csak ha nincs rajtuk aktív tétel)
-- -----------------------------------------------------------------------------
update public.categories c
set deleted_at = now()
where c.deleted_at is null
  and (
    upper(c.code) in (
      'EP', 'NY', 'GE', 'EL', 'RI',
      'EP-BON', 'BURK', 'EP-SZL',
      'NY-ALU', 'NY-AUT',
      'GE-KL', 'GE-CS', 'GE-BER',
      'EL-BON', 'EL-SZ', 'EL-MER'
    )
    or upper(c.code) like 'DDC-%'
  )
  and not exists (
    select 1
    from public.cost_items ci
    where ci.category_id = c.id
      and ci.deleted_at is null
  );

-- -----------------------------------------------------------------------------
-- 2. Új kategóriák (lapos, szakág-prefixes kódokkal, építési sorrendben)
-- -----------------------------------------------------------------------------
insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, null, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    -- Előkészítés, tervezés, engedélyezés (a teljes projektköltség "puha" oldala)
    ('elokeszites',     'EK-01',  'Geodézia, talajmechanika',                 1),
    ('elokeszites',     'EK-02',  'Tervezés (építész, statika, szakági)',     2),
    ('elokeszites',     'EK-03',  'Engedélyezés, hatósági díjak',             3),
    ('elokeszites',     'EK-04',  'Közműfejlesztési hozzájárulás',            4),
    ('elokeszites',     'EK-05',  'Műszaki ellenőrzés, projektmenedzsment',   5),
    -- Organizáció, felvonulás (TERC 12)
    ('organizacio',     'ORG-01', 'Felvonulás, ideiglenes létesítmény',      1),
    ('organizacio',     'ORG-02', 'Ideiglenes közmű (víz, villany)',          2),
    ('organizacio',     'ORG-03', 'Védelem, takarás',                         3),
    -- Bontás
    ('bontas',          'BON-01', 'Teljes szerkezetbontás',                   1),
    ('bontas',          'BON-02', 'Válaszfal- és burkolatbontás',             2),
    ('bontas',          'BON-03', 'Gépészeti, elektromos bontás',             3),
    ('bontas',          'BON-04', 'Törmelékszállítás, konténer',              4),
    -- Földmunka (TERC 21)
    ('foldmunka',       'FOL-01', 'Tereprendezés, humuszolás',                1),
    ('foldmunka',       'FOL-02', 'Munkagödör, árokásás',                     2),
    ('foldmunka',       'FOL-03', 'Visszatöltés, tömörítés',                  3),
    ('foldmunka',       'FOL-04', 'Csapadékvíz-elvezetés, szikkasztó',        4),
    -- Építőmesteri munkák (TERC 23, 15+31, 33, 36)
    ('epitomester',     'EM-01',  'Alapozás',                                 1),
    ('epitomester',     'EM-02',  'Zsaluzás, beton, vasbeton',                2),
    ('epitomester',     'EM-03',  'Falazás',                                  3),
    ('epitomester',     'EM-04',  'Válaszfalépítés',                          4),
    ('epitomester',     'EM-05',  'Vakolás, rabicolás',                       5),
    ('epitomester',     'EM-06',  'Kémény, kandalló',                         6),
    -- Ácsmunka (TERC 35)
    ('acs',             'ACS-01', 'Tetőszerkezet',                            1),
    ('acs',             'ACS-02', 'Fafödém, gerendázat',                      2),
    ('acs',             'ACS-03', 'Lécezés, fóliázás, ellenléc',              3),
    ('acs',             'ACS-04', 'Terasz- és pergolaszerkezet',              4),
    -- Tetőfedés (TERC 41)
    ('tetofedes',       'TET-01', 'Cserépfedés',                              1),
    ('tetofedes',       'TET-02', 'Fém- és lemezfedés',                       2),
    ('tetofedes',       'TET-03', 'Szegélyek, kiegészítők',                   3),
    -- Bádogozás (TERC 43)
    ('badogozas',       'BAD-01', 'Ereszcsatorna, lefolyó',                   1),
    ('badogozas',       'BAD-02', 'Párkány- és fallefedés',                   2),
    -- Vízszigetelés (TERC 48)
    ('vizszigeteles',   'VSZ-01', 'Talajnedvesség elleni szigetelés',         1),
    ('vizszigeteles',   'VSZ-02', 'Lapostető- és teraszszigetelés',           2),
    ('vizszigeteles',   'VSZ-03', 'Beltéri kenhető szigetelés',               3),
    -- Homlokzati hőszigetelés (TERC 48)
    ('homlokzat',       'HOM-01', 'Hőszigetelő rendszer (EPS)',               1),
    ('homlokzat',       'HOM-02', 'Hőszigetelő rendszer (kőzetgyapot)',       2),
    ('homlokzat',       'HOM-03', 'Színvakolat, díszítés',                    3),
    ('homlokzat',       'HOM-04', 'Lábazat',                                  4),
    ('homlokzat',       'HOM-05', 'Homlokzati kőburkolat, klinker',           5),
    -- Állványozás (TERC 15)
    ('allvanyozas',     'ALL-01', 'Homlokzati állvány',                       1),
    ('allvanyozas',     'ALL-02', 'Belső állvány, gurulóállvány',             2),
    -- Gépészet (TERC 81/82: alapszerelés → szerelvényezés)
    ('gepeszet',        'GE-01',  'Alapszerelés (víz, csatorna)',             1),
    ('gepeszet',        'GE-02',  'Szaniter, szerelvényezés',                 2),
    ('gepeszet',        'GE-03',  'Külső közmű, bekötővezeték',               3),
    -- Fűtés-hűtés
    ('futes-hutes',     'FUT-01', 'Kazán, hőközpont',                         1),
    ('futes-hutes',     'FUT-02', 'Hőszivattyú',                              2),
    ('futes-hutes',     'FUT-03', 'Radiátoros fűtés',                         3),
    ('futes-hutes',     'FUT-04', 'Felületfűtés (padló, fal)',                4),
    -- Klíma, szellőzés
    ('klima-szellozes', 'KLI-01', 'Split klíma',                              1),
    ('klima-szellozes', 'KLI-02', 'Multi split, VRF-rendszer',                2),
    ('klima-szellozes', 'KLI-03', 'Szellőzés, hővisszanyerő',                 3),
    -- Gázszerelés
    ('gazszereles',     'GAZ-01', 'Gázvezeték-szerelés',                      1),
    ('gazszereles',     'GAZ-02', 'Készüléktelepítés, bekötés',               2),
    -- Elektromos (alapszerelés → szerelvényezés → mérés)
    ('elektromos',      'EL-01',  'Alapszerelés (védőcső, kábelezés)',        1),
    ('elektromos',      'EL-02',  'Elosztó, mérőhely',                        2),
    ('elektromos',      'EL-03',  'Szerelvényezés',                           3),
    ('elektromos',      'EL-04',  'Világítás',                                4),
    ('elektromos',      'EL-05',  'Mérés, jegyzőkönyv',                       5),
    ('elektromos',      'EL-06',  'Szolgáltatói becsatlakozás (áram, telekom)', 6),
    -- Gyengeáram
    ('riaszto',         'RI-01',  'Riasztórendszer',                          1),
    ('riaszto',         'RI-02',  'Kamerarendszer',                           2),
    ('riaszto',         'RI-03',  'Strukturált hálózat',                      3),
    ('riaszto',         'RI-04',  'Beléptető, kaputelefon',                   4),
    -- Napelem
    ('napelem',         'NAP-01', 'Panel, tartószerkezet',                    1),
    ('napelem',         'NAP-02', 'Inverter, villamos bekötés',               2),
    ('napelem',         'NAP-03', 'Engedélyeztetés, hálózatra kapcsolás',     3),
    -- Szárazépítés (TERC 39)
    ('szarazepites',    'SZE-01', 'Válaszfal',                                1),
    ('szarazepites',    'SZE-02', 'Álmennyezet',                              2),
    ('szarazepites',    'SZE-03', 'Előtétfal, aknafal',                       3),
    ('szarazepites',    'SZE-04', 'Tetőtér-beépítés',                         4),
    -- Burkolás (TERC 42)
    ('burkolas',        'BUR-01', 'Esztrich, aljzatkiegyenlítés',             1),
    ('burkolas',        'BUR-02', 'Hidegburkolat',                            2),
    ('burkolas',        'BUR-03', 'Melegburkolat',                            3),
    ('burkolas',        'BUR-04', 'Szegély, lábazat',                         4),
    -- Festés (TERC 47)
    ('festes',          'FES-01', 'Glettelés, felület-előkészítés',           1),
    ('festes',          'FES-02', 'Beltéri festés',                           2),
    ('festes',          'FES-03', 'Mázolás',                                  3),
    ('festes',          'FES-04', 'Tapétázás',                                4),
    ('festes',          'FES-05', 'Homlokzatfestés',                          5),
    -- Nyílászáró (TERC 44/45)
    ('nyilaszaró',      'NYI-01', 'Műanyag nyílászáró',                       1),
    ('nyilaszaró',      'NYI-02', 'Fa nyílászáró',                            2),
    ('nyilaszaró',      'NYI-03', 'Alumíniumszerkezet',                       3),
    ('nyilaszaró',      'NYI-04', 'Beépítés, párkány, takarás',               4),
    -- Árnyékolás
    ('arnyekolas',      'ARN-01', 'Redőny',                                   1),
    ('arnyekolas',      'ARN-02', 'Zsalúzia, screen',                         2),
    ('arnyekolas',      'ARN-03', 'Napellenző',                               3),
    -- Asztalos
    ('asztalos',        'ASZ-01', 'Beltéri ajtó',                             1),
    ('asztalos',        'ASZ-02', 'Konyha, beépített bútor',                  2),
    ('asztalos',        'ASZ-03', 'Egyedi asztalosmunka',                     3),
    -- Lakatos (TERC 45)
    ('lakatos',         'LAK-01', 'Korlát, lépcső',                           1),
    ('lakatos',         'LAK-02', 'Kapu, kerítéselem',                        2),
    ('lakatos',         'LAK-03', 'Egyedi fémszerkezet',                      3),
    -- Térburkolás
    ('terburkolas',     'TER-01', 'Térkőburkolat',                            1),
    ('terburkolas',     'TER-02', 'Szegély, folyóka',                         2),
    ('terburkolas',     'TER-03', 'Kerítésépítés',                            3),
    -- Kertépítés
    ('kertepites',      'KER-01', 'Növénytelepítés, füvesítés',               1),
    ('kertepites',      'KER-02', 'Öntözőrendszer',                           2),
    ('kertepites',      'KER-03', 'Kerti építmény',                           3)
    -- Takarítás kategóriák: 019_categories_expand.sql
) as v(trade, code, name, sort_order)
on conflict (organization_id, lower(code)) where deleted_at is null
do update set
  trade = excluded.trade,
  name = excluded.name,
  sort_order = excluded.sort_order;

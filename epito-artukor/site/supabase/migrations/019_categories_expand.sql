-- =============================================================================
-- Építő Ártükör — Kategória bővítés (019)
-- =============================================================================
-- Előfeltétel: 017_trades_seed.sql és 018_categories_seed.sql lefutottak
--
-- ~31 új kategória meglévő szakágakba (0 új szakág). Cél: kitölteni a gyakori
-- árajánlati réseket anélkül, hogy enterprise-szintű TERC-adatbázis lenne.
-- Idempotens: kód alapú upsert, meglévő kategóriák nem sérülnek.
-- =============================================================================

insert into public.categories (organization_id, parent_id, trade, code, name, sort_order)
select o.id, null, v.trade, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    -- Előkészítés — energetika (nem külön szakág)
    ('elokeszites',     'EK-06',  'Energetikai tanúsítás',                    6),
    ('elokeszites',     'EK-07',  'Hőkamerás vizsgálat',                       7),
    ('elokeszites',     'EK-08',  'Blower-door teszt, energetikai audit',      8),

    -- Organizáció — szállítás, daru, terület (nem külön logisztika-szakág)
    ('organizacio',     'ORG-04', 'Anyagmozgatás, rakodás, daruzás',          4),
    ('organizacio',     'ORG-05', 'Munkaterület-védelem, porta, őrzés',        5),
    ('organizacio',     'ORG-06', 'Mobil WC, konténer, ideiglenes raktár',     6),

    -- Bontás — speciális
    ('bontas',          'BON-05', 'Veszélyes hulladék, speciális bontás',      5),
    ('bontas',          'BON-06', 'Szelektív bontás, újrahasznosítás',         6),

    -- Építőmesteri munkák — finomabb bontás
    ('epitomester',     'EM-07',  'Betonacél szerelés',                        7),
    ('epitomester',     'EM-08',  'Födém, áthidaló, koszorú',                  8),
    ('epitomester',     'EM-09',  'Lépcső, rámpa',                             9),
    ('epitomester',     'EM-10',  'Javító kőműves munkák',                    10),

    -- Gépészet
    ('gepeszet',        'GE-04',  'Vízlágyító, vízkezelés',                    4),
    ('gepeszet',        'GE-05',  'Szennyvízátemelő, gépészeti akna',          5),

    -- Fűtés-hűtés
    ('futes-hutes',     'FUT-05', 'Hőleadók, osztó-gyűjtő',                    5),
    ('futes-hutes',     'FUT-06', 'Puffertartály, HMV-tartály',                6),
    ('futes-hutes',     'FUT-07', 'Beszabályozás, beüzemelés',                 7),

    -- Elektromos — EV + villámvédelem (nem külön szakág)
    ('elektromos',      'EL-07',  'EV töltő',                                  7),
    ('elektromos',      'EL-08',  'Villámvédelem, EPH, földelés',              8),

    -- Gyengeáram — okosotthon (nem külön szakág)
    ('riaszto',         'RI-05',  'Okosotthon alapszerelés (KNX, Loxone)',     5),
    ('riaszto',         'RI-06',  'Világítás- és árnyékolásvezérlés',          6),

    -- Burkolás
    ('burkolas',        'BUR-05', 'Teraszburkolat, kültéri burkolat',          5),
    ('burkolas',        'BUR-06', 'Zuhany, lejtésképzés, folyóka',             6),

    -- Festés
    ('festes',          'FES-06', 'Penészmentesítés, speciális bevonat',       6),

    -- Nyílászáró
    ('nyilaszaró',      'NYI-05', 'Bejárati ajtó',                             5),
    ('nyilaszaró',      'NYI-06', 'Garázskapu',                                6),
    ('nyilaszaró',      'NYI-07', 'Üvegfal, portál',                           7),

    -- Takarítás (eddig szándékosan üres volt — most 4 kategória)
    ('takaritas',       'TAK-01', 'Durvatakarítás',                            1),
    ('takaritas',       'TAK-02', 'Finomtakarítás',                            2),
    ('takaritas',       'TAK-03', 'Átadás előtti takarítás',                   3),
    ('takaritas',       'TAK-04', 'Hulladékelszállítás, lomtalanítás',         4)
) as v(trade, code, name, sort_order)
on conflict (organization_id, lower(code)) where deleted_at is null
do update set
  trade = excluded.trade,
  name = excluded.name,
  sort_order = excluded.sort_order;

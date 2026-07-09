-- =============================================================================
-- Építő Ártükör — Teljes szakág-lista seed (manuálisan futtasd a Supabase SQL Editorban)
-- =============================================================================
-- Előfeltétel: 001–005 migrációk lefutottak (organizations, trades)
--
-- 28 szakág, magyar kivitelezői gyakorlat + TERC munkanem-logika szerint,
-- építési sorrendben (a "puha" előkészítési költségekkel együtt — a rendszer
-- a teljes projektköltséget fedi le). Minden szervezetre fut (idempotens):
-- a hiányzó szakágakat beszúrja, a meglévőket (kód alapján) az új névre és
-- sorrendre frissíti. A meglévő 5 kód (epitomester, nyilaszaró, gepeszet,
-- elektromos, riaszto) változatlan marad, így a korábban felvitt adatok
-- nem sérülnek.
-- =============================================================================

insert into public.trades (organization_id, code, name, sort_order)
select o.id, v.code, v.name, v.sort_order
from public.organizations o
cross join (
  values
    -- Előkészítés
    ('elokeszites',     'Előkészítés, tervezés, engedélyezés',     1),
    ('organizacio',     'Organizáció, felvonulás',                 2),
    ('bontas',          'Bontás',                                  3),
    ('foldmunka',       'Földmunka, tereprendezés',                4),
    -- Szerkezetépítés
    ('epitomester',     'Építőmesteri munkák',                     5),
    ('acs',             'Ácsmunka, tetőszerkezet',                 6),
    ('tetofedes',       'Tetőfedés',                               7),
    ('badogozas',       'Bádogozás',                               8),
    ('vizszigeteles',   'Vízszigetelés',                           9),
    ('homlokzat',       'Homlokzati hőszigetelés',                10),
    ('allvanyozas',     'Állványozás',                            11),
    -- Épületgépészet / elektromos (alapszereléstől)
    ('gepeszet',        'Gépészet (víz, szennyvíz, szaniter)',    12),
    ('futes-hutes',     'Fűtés-hűtés (hőszivattyú, kazán)',       13),
    ('klima-szellozes', 'Klíma, szellőzés',                       14),
    ('gazszereles',     'Gázszerelés',                            15),
    ('elektromos',      'Elektromos (erősáram)',                  16),
    ('riaszto',         'Gyengeáram (riasztó, kamera, hálózat)',  17),
    ('napelem',         'Napelemes rendszer',                     18),
    -- Belső szakipar (befejező sorrendben)
    ('szarazepites',    'Szárazépítés (gipszkarton)',             19),
    ('burkolas',        'Burkolás',                               20),
    ('festes',          'Festés, mázolás, tapétázás',             21),
    ('nyilaszaró',      'Nyílászáró',                             22),
    ('arnyekolas',      'Árnyékolástechnika',                     23),
    ('asztalos',        'Asztalosmunka, belsőépítészet',          24),
    ('lakatos',         'Lakatosmunka, fémszerkezet',             25),
    -- Kültér / átadás
    ('terburkolas',     'Térburkolás, kerítés',                   26),
    ('kertepites',      'Kertépítés, parképítés',                 27),
    ('takaritas',       'Építés utáni takarítás',                 28)
) as v(code, name, sort_order)
on conflict (organization_id, lower(code)) where deleted_at is null
do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

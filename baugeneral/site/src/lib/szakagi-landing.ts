/**
 * Szakági landing: egy URL, SEO-sűrű informatív mellékág.
 */

import { REFERENCE_STOCK as S } from "@/lib/reference-stock-images"

export const SZAKAGI_HERO = {
  eyebrow: "BauGenerál",
  title: "Szakági kivitelezés Bács-Kiskun és Pest megyében",
  lead:
    "Villanyszerelő, gépész, burkoló, térkövező, festő, kerítés, hőszigetelés, gipszkarton, napelem: szakáganként is, generálkivitelezés nélkül. Kecskemét és Bács-Kiskun, Pest megye, Balaton környéke.",
  image: S.munka,
  imageAlt: "Szakági kivitelezés a helyszínen, BauGenerál",
  ctaPrimary: { href: "#szakagi-form", label: "Írjon nekünk" },
  ctaSecondary: { href: "#szakagak", label: "Szakágak" },
} as const

export const SZAKAGI_TRADES_HEAD = {
  label: "Szakágak",
  title: "Milyen szakembert keres?",
  intro:
    "Villanyszerelő, burkoló, gépész, térkövező, festő, kerítés, hőszigetelés, gipszkarton vagy napelem: szakáganként is vállaljuk, generálkivitelezés nélkül. Bács-Kiskun (Kecskemét), Pest megye, Balaton környéke.",
} as const

export const SZAKAGI_TRADES = [
  {
    id: "villany",
    title: "Villanyszerelés",
    seoTitle: "Villanyszerelő Kecskeméten, Bács-Kiskun és Pest megyében",
    description:
      "Erős- és gyengeáram, elosztók, világítás. Új hálózat vagy meglévő bővítés.",
    body: [
      "Ha villanyszerelőt keres Kecskeméten vagy Pest megyében, gyakran nem generálkivitelezőre van szüksége, hanem egy megbízható villamos szakágra: új hálózat, lakásfelújítás, vezetékcsere, elosztó, világítás.",
      "Vállaljuk az erősáramú és gyengeáramú szerelést, dokumentált átadással. Gyakori megkeresés: komplett hálózat felújítás, alumínium vezetékcsere, villanyóra szabványosítás vagy teljesítménybővítés, új épület villamos kiépítése.",
      "Írja meg a helyszínt (Bács-Kiskun, Pest megye vagy Balaton környéke) és mit kér: négyzetméter, új vagy meglévő hálózat. Írásos ajánlatot adunk.",
    ],
    bullets: [
      "Új villamos hálózat kiépítése",
      "Meglévő hálózat felújítása, vezetékcsere",
      "Elosztó, biztosítékok, világítás",
      "Villanyóra bővítés, szabványosítás (megegyezés szerint)",
    ],
    image: S.skyBack,
    imageAlt: "Villanyszerelés helyőrző fotó",
  },
  {
    id: "gepeszet",
    title: "Épületgépészet",
    seoTitle: "Vízszerelő, fűtésszerelő, épületgépészet",
    description: "Fűtés, víz, csatorna, szellőzés. Meglévő vagy új épülethez.",
    body: [
      "Gépészt, vízszerelőt vagy fűtésszerelőt sokan külön keresnek: radiátorcsere, padlófűtés, bojler, vízvezeték, csatorna, szellőzés. Nálunk ez egy szakági megbízás lehet, generál nélkül.",
      "Új építésnél és felújításnál is vállaljuk a gépészeti kivitelezést egyeztetett műszaki tartalom alapján. Gyakori megkeresés: megbízható fűtés és víz a környéken, radiátorcsere, padlófűtés, bojler.",
      "Bács-Kiskun megyében (Kecskemét) és Pest megyében is. Írja meg, fűtés, víz vagy mindkettő kell-e, és milyen készültségű a helyszín.",
    ],
    bullets: [
      "Fűtésszerelés, radiátor, padlófűtés",
      "Vízvezeték, csatorna, bojler",
      "Szellőzés, gépészeti csatlakozások",
      "Felújítás és új épület gépészete",
    ],
    image: "/img/szakagi/gepeszet.jpg",
    imageAlt: "Épületgépészeti csövezés és vasalás a födémbetonozás előtt",
  },
  {
    id: "szerkezet",
    title: "Szerkezetépítés",
    seoTitle: "Kőműves, falazás, szerkezetépítés",
    description: "Falazás, beton, szerkezeti munkák. Önállóan vagy projekt részeként.",
    body: [
      "Kőművest, falazást, betonozást gyakran „ki ajánl megbízható kőművest?” szöveggel keresnek. Ha nem a teljes ház generálja kell, hanem szerkezeti szakág, azt is vállaljuk.",
      "Falazás, beton, szerkezeti átalakítás: önálló megbízásként vagy nagyobb kivitelezés részeként. A tartalom az ajánlatban és a szerződésben lesz rögzítve.",
      "Kecskemét és Bács-Kiskun, Pest megye, Balaton környéke. Írja meg a helyszínt és a munka jellegét.",
    ],
    bullets: [
      "Falazás, kőműves munkák",
      "Beton, szerkezeti elemek",
      "Átalakítás, bővítés szerkezeti része",
      "Önálló szakági szerződés",
    ],
    image: "/img/szakagi/szerkezet.jpg",
    imageAlt: "Szerkezetépítés: födémbetonozás betonpumpával és zsaluzással",
  },
  {
    id: "burkolas",
    title: "Burkolás",
    seoTitle: "Burkoló, hidegburkolás Pest megyében és Bács-Kiskunban",
    description: "Fürdő, konyha, járólap, csempe. Pontos illesztés, tiszta átadás.",
    body: [
      "Burkolót Pest megyében és Kecskemét környékén folyamatosan keresnek: fürdőszoba burkolás, konyha csempe, járólap, vízszigetelés, aljzatkiegyenlítés. Ez tipikus szakági megkeresés, nem generál.",
      "Hidegburkolást vállalunk beltérben: padló, fal, fürdő, wc, konyha. Gyakori megkeresés: megbízható hidegburkoló, fürdő felújítás burkolással, járólap és csempe.",
      "Írja meg a négyzetmétert, hideg vagy vegyes burkolás kell-e, és hol van az ingatlan. Írásos ajánlatot adunk.",
    ],
    bullets: [
      "Fürdőszoba és wc hidegburkolás",
      "Konyha, járólap, csempe",
      "Vízszigetelés, aljzat-előkészítés (megegyezés szerint)",
      "Lakás- és házfelújításhoz kapcsolódó burkolás",
    ],
    image: "/img/szakagi/burkolas.jpg",
    imageAlt: "Hidegburkolás: nagylapos padlóburkolat kereskedelmi térben, fa hatású betéttel",
  },
  {
    id: "festes",
    title: "Festés, mázolás",
    seoTitle: "Szobafestő, glettelés, mázolás",
    description: "Glettelés, festés, mázolás. Belső felületek, ahogy a projekt kéri.",
    body: [
      "Szobafestőt, glettelőt, mázolót gyakran a felújítás végén keresnek: „ki fest megbízhatóan?”, „glettelés és festés egyben”. Nálunk ez önálló szakági munka lehet.",
      "Glettelés, festés, mázolás beltérben. Ha gipszkartonnal vagy burkolással együtt kell, azt is meg lehet beszélni egy megbízásban.",
      "Bács-Kiskun és Pest megye. Írja meg a helyiségeket és a felület állapotát.",
    ],
    bullets: [
      "Glettelés, festés",
      "Mázolás, belső felületek",
      "Felújítás utáni festés",
      "Együtt gipszkartonnal vagy burkolással (megegyezés szerint)",
    ],
    image: S.csaladi,
    imageAlt: "Festési munkák helyőrző fotó",
  },
  {
    id: "terko",
    title: "Térkövezés",
    seoTitle: "Térkövezés udvar, bejáró, terasz",
    description: "Udvar, kocsibejáró, terasz. Tartós burkolat, pontos lejtéssel.",
    body: [
      "Térkövezést sokan így keresnek: térkövezés udvar, kocsibejáró, járda, terasz. Önálló szakági megbízásként is vállaljuk, generál nélkül.",
      "Vállaljuk az udvari és bejárói térkövezést, lejtés és vízelvezetés figyelembevételével.",
      "Kecskemét, Bács-Kiskun, Pest megye, Balaton környéke. Írja meg a terület nagyságát és a használatot (autó, gyalogos, terasz).",
    ],
    bullets: [
      "Udvar és kocsibejáró térkövezés",
      "Terasz, járda",
      "Lejtés, vízelvezetés",
      "Új rakás vagy cseréje",
    ],
    image: "/img/szakagi/terkovezes.jpg",
    imageAlt: "Térkövezett udvar és kocsibejáró, modern családi ház kapuval",
  },
  {
    id: "kerites",
    title: "Kerítésépítés",
    seoTitle: "Kerítésépítés, kapu, lábazat",
    description: "Kerítés, kapu, lábazat. Új építés vagy csere.",
    body: [
      "Kerítésépítést, kaput, lábazatot gyakran a térkővel vagy a ház átadásával együtt keresnek. „Ki épít kerítést a környéken?” tipikus kérdés.",
      "Új kerítés, csere, kapu, lábazat: szakági megbízásként. Ha térkövezés is kell ugyanarra a telekre, egy csomagban is megbeszélhető.",
      "Pest megye és Bács-Kiskun. Írja meg a hosszúságot és a típust, amit szeretne.",
    ],
    bullets: [
      "Kerítésépítés, kerítéscsere",
      "Kapu, lábazat",
      "Udvari munkákkal együtt (térkő)",
      "Családi ház és telek kerítése",
    ],
    image: S.telephely,
    imageAlt: "Kerítésépítés helyőrző fotó",
  },
  {
    id: "hoszigeteles",
    title: "Homlokzati hőszigetelés",
    seoTitle: "Homlokzati hőszigetelés, dryvit, energetikai korszerűsítés",
    description: "Homlokzati szigetelés és felületképzés. Energetikai korszerűsítéshez.",
    body: [
      "Homlokzati hőszigetelést, dryvitet, energetikai korszerűsítést vállalunk egyeztetett rendszer szerint. Gyakori megkeresés: megbízható hőszigetelés, homlokzat szigetelés.",
      "Vállaljuk a homlokzati hőszigetelést és a kapcsolódó felületképzést. Nincs listaár a neten: a fal, a vastagság és a felület dönt.",
      "Bács-Kiskun (Kecskemét) és Pest megye. Írja meg a négyzetmétert és a jelenlegi homlokzat állapotát.",
    ],
    bullets: [
      "Homlokzati hőszigetelés",
      "Felületképzés, színezés",
      "Energetikai korszerűsítés családi háznál",
      "Önálló szakági megbízás",
    ],
    image: S.kozepulet,
    imageAlt: "Homlokzati hőszigetelés helyőrző fotó",
  },
  {
    id: "gipszkarton",
    title: "Gipszkarton",
    seoTitle: "Gipszkartonozás, válaszfal, álmennyezet",
    description: "Válaszfalak, álmennyezet, szárazépítés. Belső átalakításokhoz.",
    body: [
      "Gipszkarton, válaszfal, álmennyezet: tipikus megkeresés lakásátalakításnál és felújításnál.",
      "Szárazépítés, válaszfal, álmennyezet. Festéssel vagy burkolással együtt is megbeszélhető, ha így egyszerűbb.",
      "Pest megye és Bács-Kiskun. Írja meg, milyen helyiségek és milyen szerkezet kell.",
    ],
    bullets: [
      "Válaszfal, térelválasztás",
      "Álmennyezet",
      "Szárazépítés felújításhoz",
      "Festéssel együtt (megegyezés szerint)",
    ],
    image: S.kapcsolatHero,
    imageAlt: "Gipszkarton munkák helyőrző fotó",
  },
  {
    id: "napelem",
    title: "Napelem-telepítés",
    seoTitle: "Napelem telepítés háztartási és kisebb rendszerekhez",
    description: "Háztartási és kisebb üzleti napelem. Egyeztetett ütemben.",
    body: [
      "Napelem telepítést sokan energetikai korszerűsítéssel vagy tetőfelújítással együtt keresnek. Önálló szakági megbízásként is vállaljuk.",
      "Háztartási és kisebb üzleti rendszerek telepítése, egyeztetett műszaki tartalom és ütem szerint. Engedélyeztetést és tervezést nem vállalunk; meglévő vagy egyeztetett dokumentáció alapján indulunk.",
      "Bács-Kiskun, Pest megye, Balaton környéke. Írja meg a tetőtípust és a cél teljesítményt, ha már van.",
    ],
    bullets: [
      "Háztartási napelem telepítés",
      "Kisebb üzleti rendszerek",
      "Egyeztetett ütem, dokumentált átadás",
      "Önálló szakági szerződés",
    ],
    image: "/img/szakagi/napelem.jpg",
    imageAlt: "Napelem rendszer lapostetős modern családi házon",
  },
] as const

export const SZAKAGI_AREA = {
  label: "Hol dolgozunk",
  title: "Bács-Kiskun, Pest megye, Balaton környéke",
  body: [
    "A BauGenerál Kecskeméten van. Szakági munkát elsősorban Bács-Kiskun megyében, Pest megyében és a Balaton környékén vállalunk.",
    "Ha villanyszerelőt, burkolót, térkövezőt vagy más szakágat keres ezeken a területeken, írjon. Ha a helyszín távolabb esik, a kapcsolatfelvételnél jelezze: megmondjuk, vállalható-e.",
  ],
} as const

export const SZAKAGI_WHY = {
  label: "Miért így",
  title: "Ha csak egy szakember hiányzik.",
  body: [
    "Gyakran ez a helyzet: van már kivitelező, vagy csak villany, burkolás vagy térkő kell. Ilyenkor a teljes generál felesleges.",
    "Nálunk a szakági munka egy kapcsolattartóval, rögzített műszaki tartalommal megy. Nem kell külön világok között egyeztetnie.",
  ],
  image: S.telephely,
  imageAlt: "Kivitelezési helyszín helyőrző fotó",
} as const

export const SZAKAGI_PROCESS_HEAD = {
  label: "Így megy",
  title: "A megkereséstől az átadásig",
  intro: "Rövid folyamat. Amit írásban vállalunk, azt az ajánlatban rögzítjük.",
} as const

export const SZAKAGI_PROCESS = [
  {
    step: "01",
    title: "Megkeresés",
    description: "Leírja a szakágat és a helyszínt. Hamarosan emailben jelentkezünk.",
  },
  {
    step: "02",
    title: "Felmérés",
    description: "Pontosítjuk a műszaki tartalmat és a szükséges anyagokat.",
  },
  {
    step: "03",
    title: "Ajánlat",
    description: "Rögzítjük a kört, a határidőt és a felelősséget.",
  },
  {
    step: "04",
    title: "Kivitelezés",
    description: "A szakág egy ütemben, egy kapcsolattartóval készül el, majd átadjuk.",
  },
] as const

export const SZAKAGI_FAQ = [
  {
    id: "vs-general",
    q: "Mi a különbség a szakági megbízás és a generálkivitelezés között?",
    a: "A generálkivitelezésnél egy felelős viszi a teljes projektet: több szakág, ütem, egy szerződés. Önnek nem kell a villanyost, a gépészt és a burkolót egymáshoz igazítania.\n\nA szakági megbízás más: egy konkrét munkanemre szerződünk, például villanyszerelésre, térkövezésre vagy hőszigetelésre. Ez akkor praktikus, ha már van kivitelezője, vagy csak egy hiányzó szakágra van szüksége. A felelősség a szerződés szerinti szakági körre vonatkozik, nem az egész házra.",
  },
  {
    id: "when",
    q: "Mikor elég egy szakág, és mikor jobb a generál?",
    a: "Ha csak egy hiányzó tétel van, például térkő, kerítés, napelem vagy egy helyiség burkolása, a szakági megbízás általában gyorsabb és átláthatóbb.\n\nHa több szakág párhuzamosan fut, és a sorrend kritikus (szerkezet, gépészet, villany, burkolás), gyakran a generál a jobb forma. Ilyenkor a legnagyobb kockázat nem az ár, hanem a koordináció. Ha bizonytalan, írja meg a projektet: megmondjuk, melyik illik jobban.",
  },
  {
    id: "multi",
    q: "Több szakágot is kérhetek egyszerre, generál nélkül?",
    a: "Igen, ha a munka így átláthatóbb, és a szakágak nem akadnak bele egymásba. Két–három jól körülhatárolt tétel, például kerítés és térkő, vagy festés és gipszkarton, szakági csomagként is mehet.\n\nHa a szakágak erősen függenek egymástól, és kell valaki, aki az egész ütemet fogja, inkább generált javasolunk. Ezt az ajánlat előtt egyeztetjük, nem utólag.",
  },
  {
    id: "plans",
    q: "Kell kész terv vagy engedély a szakági munkához?",
    a: "Tervezést és engedélyeztetést nem vállalunk. A szakági munka meglévő terv vagy egyeztetett műszaki tartalom alapján indul.\n\nHa van alaprajz, műszaki leírás vagy legalább pontos helyszínfotó és méret, gyorsabban tudunk ajánlatot adni. Ha semmi nincs kéznél, az első egyeztetés célja éppen az, hogy tisztázzuk, mi a kör, és mi kell a folytatáshoz.",
  },
  {
    id: "duration",
    q: "Mennyi idő, amíg egy szakági munka kész?",
    a: "Ez a szakágtól, a mennyiségtől, az anyagtól és a helyszín készültségétől függ. Egy kerítésszakasz más ütem, mint egy teljes villamos hálózat vagy homlokzati hőszigetelés.\n\nÁltalános „X hét” ígéretet a weben nem teszünk. Amit írásban vállalunk, azt az ajánlatban rögzítjük: mit csinálunk, mikor várható a kezdés és az átadás, és mi számít kész állapotnak. Félkész helyszín vagy későbbi módosítás azonnal felülírhatja az ütemet.",
  },
  {
    id: "responsibility",
    q: "Ha a helyszín vagy az előző munka nem stimmel, ki felel?",
    a: "Szakági munkánál a kritikus pont, hol kezdődik a mi felelősségünk. Ha a fal, az aljzat vagy az előkészítés nem olyan, amire a szerződés épül, ezt a felmérésnél és az ajánlatban tisztázni kell.\n\nHa a megbízás csak a mi szakágunkra szól, és a helyszín más kivitelezőnél készül, az ajánlatban rögzítjük: mi alapján indulunk, milyen készültség kell a kezdéshez, mit vállalunk a szerelésnél. A lényeg, hogy ez előre legyen tiszta, ne a munkakezdés napján.",
  },
  {
    id: "price",
    q: "Hogyan alakul az ár, ha nincs publikus listaár?",
    a: "Szakági munkára nincs értelmes netes listaár. Az árat a műszaki tartalom, az anyag, a mennyiség, a helyszín és a beépítés nehézsége együtt határozza meg. Ugyanaz a „burkolás” két lakásban teljesen más összeg lehet.\n\nEzért először a kört tisztázzuk: melyik szakág, milyen helyiségek vagy felületek, milyen minőségi sáv. Utána írásos ajánlatot adunk. Ha változik, amit kér, az ár is változhat; ezt az ajánlatban és a szerződésben követjük. Árajánlatot a Kapcsolat oldalon tud kérni.",
  },
  {
    id: "area",
    q: "Hol vállalnak szakági munkát?",
    a: "Bács-Kiskun megyében, Pest megyében és a Balaton környékén. Ha a helyszín ettől távolabb esik, a kapcsolatfelvételnél jelezze. Megnézzük, és megmondjuk, vállalható-e.",
  },
] as const

export const SZAKAGI_CTA = {
  title: "Szakági munkát tervez?",
  body: "Válassza ki a szakágat, írja meg a helyszínt. Egy munkanapon belül visszajelzünk.",
} as const

/** Form select options = published trades + Egyéb */
export const SZAKAGI_FORM_TRADES = [
  ...SZAKAGI_TRADES.map((t) => ({ id: t.id, title: t.title })),
  { id: "egyeb", title: "Egyéb" },
] as const

export const SZAKAGI_RELATED = [
  { href: "/szolgaltatasok/felujitas", label: "Felújítás" },
  { href: "/szolgaltatasok/csaladi-haz-epites", label: "Családi ház" },
  { href: "/generalkivitelezes-pest-megye", label: "Pest megye" },
  { href: "/szolgaltatasok/asztalos-munkak", label: "Asztalos munkák" },
] as const
